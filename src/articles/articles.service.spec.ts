import { ArticlesService, type ArticleListQuery } from './articles.service';

const now = new Date();
const articleRow = (over: Record<string, unknown> = {}) => ({
  id: 'a1',
  title: '일산 ABA 안내',
  slug: '일산-aba-안내',
  excerpt: '요약',
  content: '<p>본문</p>',
  thumbnail: null,
  categoryId: null,
  category: null,
  seoTitle: null,
  seoDescription: null,
  canonicalUrl: null,
  targetAudience: null,
  relatedProgram: null,
  relatedLocation: null,
  faqItems: [],
  structuredDataType: null,
  isFeatured: false,
  status: 'published',
  publishedAt: now,
  views: 0,
  order: 0,
  visible: true,
  deletedAt: null,
  createdAt: now,
  updatedAt: now,
  tags: [] as { tag: Record<string, unknown> }[],
  ...over,
});

function makeService() {
  const prisma = {
    article: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(articleRow()),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    tag: { count: jest.fn().mockResolvedValue(0) },
  };
  return { prisma, service: new ArticlesService(prisma as never) };
}

const query = (over: Partial<ArticleListQuery> = {}): ArticleListQuery =>
  ({ page: 1, pageSize: 20, ...over }) as ArticleListQuery;

describe('ArticlesService.list', () => {
  it('public list only sees visible published posts', async () => {
    const { prisma, service } = makeService();
    await service.list(query(), false);
    const where = prisma.article.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ status: 'published', visible: true, deletedAt: null });
  });

  it('admin list with status=all drops the status filter and flattens tags', async () => {
    const { prisma, service } = makeService();
    prisma.article.findMany.mockResolvedValue([
      articleRow({ tags: [{ tag: { id: 't1', name: '일산 ABA' } }] }),
    ]);
    prisma.article.count.mockResolvedValue(1);
    const res = await service.list(query({ status: 'all' }), true);
    const where = prisma.article.findMany.mock.calls[0][0].where;
    expect(where.status).toBeUndefined();
    expect(res.items[0].tags).toEqual([{ id: 't1', name: '일산 ABA' }]);
  });

  it('category/tag/search/featured filters land in the where clause', async () => {
    const { prisma, service } = makeService();
    await service.list(
      query({ category: 'aba-info', tag: 'ilsan-aba', q: '조기', featured: 'true' }),
      false,
    );
    const where = prisma.article.findMany.mock.calls[0][0].where;
    expect(where.category).toBeDefined();
    expect(where.tags).toBeDefined();
    expect(where.OR).toHaveLength(3);
    expect(where.isFeatured).toBe(true);
  });
});

describe('ArticlesService.findOne', () => {
  it('throws for a draft when requested publicly', async () => {
    const { prisma, service } = makeService();
    prisma.article.findFirst.mockResolvedValue(null);
    await expect(service.findOne('draft-slug')).rejects.toThrow('게시글을 찾을 수 없습니다');
    expect(prisma.article.findFirst.mock.calls[0][0].where.status).toBe('published');
  });

  it('counts a public view (fire-and-forget increment)', async () => {
    const { prisma, service } = makeService();
    prisma.article.findFirst.mockResolvedValue(articleRow({ views: 4 }));
    prisma.article.update.mockResolvedValue(articleRow());
    const out = await service.findOne('일산-aba-안내', { countView: true });
    expect(out.views).toBe(5);
    expect(prisma.article.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { views: { increment: 1 } } }),
    );
  });
});

describe('ArticlesService.create', () => {
  it('slugifies the title, fills SEO defaults and stamps publishedAt on publish', async () => {
    const { prisma, service } = makeService();
    prisma.article.findFirst.mockResolvedValue(null); // slug free
    prisma.article.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(articleRow({ ...data, tags: [] })),
    );
    await service.create({
      title: '조기교실 안내!',
      content: '<p>조기교실은 <strong>만 3–5세</strong> 아동을 위한 프로그램입니다.</p>',
      status: 'published',
    });
    const data = prisma.article.create.mock.calls[0][0].data;
    expect(data.slug).toBe('조기교실-안내');
    expect(data.excerpt).toContain('조기교실은');
    expect(data.excerpt).not.toContain('<'); // tags stripped
    expect(data.seoTitle).toBe('조기교실 안내! | 정지은일산ABA');
    expect(data.publishedAt).toBeInstanceOf(Date);
  });

  it('rejects a duplicate slug with a conflict', async () => {
    const { prisma, service } = makeService();
    prisma.article.findFirst.mockResolvedValue(articleRow());
    await expect(service.create({ title: '일산 ABA 안내' })).rejects.toThrow(
      '이미 사용 중인 슬러그',
    );
  });

  it('rejects more than 8 tags', async () => {
    const { prisma, service } = makeService();
    prisma.article.findFirst.mockResolvedValue(null);
    const tagIds = Array.from({ length: 9 }, (_, i) => 't' + i);
    await expect(service.create({ title: '태그 초과', tagIds })).rejects.toThrow('최대 8개');
  });

  it('rejects unknown tag ids', async () => {
    const { prisma, service } = makeService();
    prisma.article.findFirst.mockResolvedValue(null);
    prisma.tag.count.mockResolvedValue(1); // only 1 of 2 exists
    await expect(service.create({ title: '태그 검증', tagIds: ['t1', 'ghost'] })).rejects.toThrow(
      '존재하지 않는 태그',
    );
  });
});

describe('ArticlesService.update', () => {
  it('replaces tag links when tagIds are provided and stamps first publish', async () => {
    const { prisma, service } = makeService();
    prisma.article.findUnique.mockResolvedValue(articleRow({ status: 'draft', publishedAt: null }));
    prisma.article.findFirst.mockResolvedValue(null);
    prisma.tag.count.mockResolvedValue(1);
    prisma.article.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(articleRow({ tags: [] })),
    );
    await service.update('a1', { status: 'published', tagIds: ['t1'] });
    const data = prisma.article.update.mock.calls[0][0].data;
    expect(data.publishedAt).toBeInstanceOf(Date);
    expect(data.tags).toEqual({ deleteMany: {}, create: [{ tagId: 't1' }] });
  });

  it('throws for an unknown article', async () => {
    const { prisma, service } = makeService();
    prisma.article.findUnique.mockResolvedValue(null);
    await expect(service.update('missing', {})).rejects.toThrow('찾을 수 없습니다');
  });
});

describe('ArticlesService delete/restore/visibility', () => {
  it('softDelete throws when nothing matched', async () => {
    const { prisma, service } = makeService();
    prisma.article.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.softDelete('missing')).rejects.toThrow('찾을 수 없습니다');
  });

  it('restore un-deletes and returns the row', async () => {
    const { prisma, service } = makeService();
    prisma.article.updateMany.mockResolvedValue({ count: 1 });
    prisma.article.findFirst.mockResolvedValue(articleRow());
    const out = await service.restore('a1');
    expect(out.id).toBe('a1');
  });

  it('hardDelete maps prisma failure to not-found', async () => {
    const { prisma, service } = makeService();
    prisma.article.delete.mockRejectedValue(new Error('P2025'));
    await expect(service.hardDelete('missing')).rejects.toThrow('찾을 수 없습니다');
  });

  it('setVisibility flips the flag', async () => {
    const { prisma, service } = makeService();
    prisma.article.findFirst.mockResolvedValue(articleRow());
    prisma.article.update.mockResolvedValue(articleRow({ visible: false }));
    await service.setVisibility('a1', false);
    expect(prisma.article.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { visible: false } }),
    );
  });
});

describe('ArticlesService.related', () => {
  it('walks the buckets, de-duplicates and caps at the limit', async () => {
    const { prisma, service } = makeService();
    prisma.article.findFirst.mockResolvedValue(
      articleRow({ id: 'base', categoryId: 'c1', tags: [{ tagId: 't1' }] }),
    );
    const mk = (id: string) => articleRow({ id, tags: [] });
    prisma.article.findMany
      .mockResolvedValueOnce([mk('r1'), mk('r2')]) // same tag
      .mockResolvedValueOnce([mk('r2'), mk('r3')]) // same category (r2 dup)
      .mockResolvedValue([mk('r4')]); // latest fallback
    const out = await service.related('base', 4);
    expect(out.map((a) => a.id)).toEqual(['r1', 'r2', 'r3', 'r4']);
  });

  it('throws when the base article does not exist', async () => {
    const { prisma, service } = makeService();
    prisma.article.findFirst.mockResolvedValue(null);
    await expect(service.related('missing')).rejects.toThrow('찾을 수 없습니다');
  });
});

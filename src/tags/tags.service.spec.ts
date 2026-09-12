import { TagsService, TAG_INDEX_MIN_ARTICLES } from './tags.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

type Mock = jest.Mock;
const tagRow = (over: Record<string, unknown> = {}) => ({
  id: 't1',
  name: '고양시 ABA',
  slug: 'goyang-aba',
  description: null,
  seoTitle: null,
  seoDescription: null,
  tagType: 'LOCATION',
  seoIndexed: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

function makeService() {
  const prisma = {
    tag: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    articleTag: { groupBy: jest.fn().mockResolvedValue([]) },
  };
  return { prisma, service: new TagsService(prisma as never) };
}

const query = (over: Partial<PaginationQueryDto> = {}): PaginationQueryDto =>
  ({ page: 1, pageSize: 20, ...over }) as PaginationQueryDto;

describe('TagsService', () => {
  it('list returns views with published article counts and indexable flag', async () => {
    const { prisma, service } = makeService();
    prisma.tag.findMany.mockResolvedValue([tagRow(), tagRow({ id: 't2', slug: 'b', name: 'b' })]);
    prisma.tag.count.mockResolvedValue(2);
    prisma.articleTag.groupBy.mockResolvedValue([
      { tagId: 't1', _count: { tagId: TAG_INDEX_MIN_ARTICLES } },
    ]);
    const res = await service.list(query());
    expect(res.total).toBe(2);
    expect(res.items[0]).toMatchObject({ id: 't1', articleCount: 3, indexable: true });
    expect(res.items[1]).toMatchObject({ id: 't2', articleCount: 0, indexable: false });
  });

  it('list applies free-text search over name and slug', async () => {
    const { prisma, service } = makeService();
    prisma.tag.findMany.mockResolvedValue([]);
    prisma.tag.count.mockResolvedValue(0);
    await service.list(query({ q: '고양' }));
    const where = prisma.tag.findMany.mock.calls[0][0].where;
    expect(where.OR).toHaveLength(2);
  });

  it('seoIndexed forces indexable even below the article threshold', async () => {
    const { prisma, service } = makeService();
    prisma.tag.findFirst.mockResolvedValue(tagRow({ seoIndexed: true }));
    const view = await service.findOne('goyang-aba');
    expect(view.indexable).toBe(true);
    expect(view.articleCount).toBe(0);
  });

  it('findOne throws for an unknown tag', async () => {
    const { prisma, service } = makeService();
    prisma.tag.findFirst.mockResolvedValue(null);
    await expect(service.findOne('nope')).rejects.toThrow('태그를 찾을 수 없습니다');
  });

  it('create slugifies the name when no slug is given', async () => {
    const { prisma, service } = makeService();
    prisma.tag.findFirst.mockResolvedValue(null);
    prisma.tag.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(tagRow(data)),
    );
    const view = await service.create({ name: '  일산 ABA ' });
    expect(view.name).toBe('일산 ABA');
    expect(view.slug).toBe('일산-aba');
  });

  it('create rejects duplicate name/slug', async () => {
    const { prisma, service } = makeService();
    prisma.tag.findFirst.mockResolvedValue(tagRow());
    await expect(service.create({ name: '고양시 ABA' })).rejects.toThrow('이미 존재하는 태그');
  });

  it('create rejects names that cannot form a slug', async () => {
    const { service } = makeService();
    await expect(service.create({ name: '!!!' })).rejects.toThrow('올바르지 않습니다');
  });

  it('update re-slugs when the name changes and keeps other fields', async () => {
    const { prisma, service } = makeService();
    prisma.tag.findUnique.mockResolvedValue(tagRow());
    prisma.tag.findFirst.mockResolvedValue(null);
    prisma.tag.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(tagRow(data)),
    );
    const view = await service.update('t1', { name: '새 태그', slug: '' });
    expect(view.slug).toBe('새-태그');
  });

  it('update throws for an unknown id', async () => {
    const { prisma, service } = makeService();
    prisma.tag.findUnique.mockResolvedValue(null);
    await expect(service.update('missing', { name: 'x' })).rejects.toThrow('찾을 수 없습니다');
  });

  it('remove maps prisma delete failure to not-found', async () => {
    const { prisma, service } = makeService();
    (prisma.tag.delete as Mock).mockRejectedValue(new Error('P2025'));
    await expect(service.remove('missing')).rejects.toThrow('태그를 찾을 수 없습니다');
  });

  it('indexableTags keeps only indexable tags that have posts', async () => {
    const { prisma, service } = makeService();
    prisma.tag.findMany.mockResolvedValue([
      tagRow({ id: 'a', slug: 'a', name: 'a' }), // 3 posts → indexable
      tagRow({ id: 'b', slug: 'b', name: 'b', seoIndexed: true }), // forced but 0 posts → excluded
      tagRow({ id: 'c', slug: 'c', name: 'c' }), // 1 post → not indexable
    ]);
    prisma.articleTag.groupBy.mockResolvedValue([
      { tagId: 'a', _count: { tagId: 3 } },
      { tagId: 'c', _count: { tagId: 1 } },
    ]);
    const out = await service.indexableTags();
    expect(out.map((t) => t.id)).toEqual(['a']);
  });
});

import { SeoService } from './seo.service';

const article = (over: Record<string, unknown> = {}) => ({
  id: 'a1',
  title: '일산 ABA 센터 선택 가이드',
  slug: 'ilsan-aba-guide',
  excerpt: '부모님을 위한 가이드',
  content: '<p>본문<script>alert(1)</script></p>',
  thumbnail: 'https://cdn/img.png',
  category: { id: 'c1', name: 'ABA 전문 정보', slug: 'aba-info' },
  categoryId: 'c1',
  seoTitle: null,
  seoDescription: null,
  canonicalUrl: null,
  relatedProgram: null,
  faqItems: [{ q: '몇 살부터 가능한가요?', a: '만 3세부터 가능합니다.' }],
  status: 'published',
  publishedAt: new Date('2026-09-13'),
  createdAt: new Date('2026-09-13'),
  updatedAt: new Date('2026-09-13'),
  views: 0,
  tags: [{ id: 't1', name: '일산 ABA', slug: 'ilsan-aba' }],
  ...over,
});

function makeService() {
  const prisma = {
    article: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    program: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  const articles = {
    list: jest.fn().mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 }),
    findOne: jest.fn(),
    related: jest.fn().mockResolvedValue([]),
  };
  const tags = {
    findOne: jest.fn(),
    indexableTags: jest.fn().mockResolvedValue([]),
  };
  return {
    prisma,
    articles,
    tags,
    service: new SeoService(prisma as never, articles as never, tags as never),
  };
}

describe('SeoService.sitemapXml', () => {
  it('lists home, blog, published posts and indexable tag pages', async () => {
    const { prisma, tags, service } = makeService();
    prisma.article.findMany.mockResolvedValue([
      { slug: 'post-1', updatedAt: new Date() },
      { slug: '한글-슬러그', updatedAt: new Date() },
    ]);
    tags.indexableTags.mockResolvedValue([{ slug: 'ilsan-aba', updatedAt: new Date() }]);
    const xml = await service.sitemapXml();
    expect(xml).toContain('<urlset');
    expect(xml).toContain('https://www.chungaba.com/</loc>');
    expect(xml).toContain('/blog</loc>');
    expect(xml).toContain('/blog/post-1');
    expect(xml).toContain('/blog/' + encodeURIComponent('한글-슬러그'));
    expect(xml).toContain('/tags/ilsan-aba');
  });
});

describe('SeoService.articleHtml', () => {
  it('renders sanitized content with canonical, OG and FAQPage JSON-LD', async () => {
    const { articles, service } = makeService();
    articles.findOne.mockResolvedValue(article());
    const html = (await service.articleHtml('ilsan-aba-guide')) as string;
    expect(html).toContain('일산 ABA 센터 선택 가이드');
    expect(html).not.toContain('<script>alert'); // sanitized body
    expect(html).toContain('rel="canonical"');
    expect(html).toContain('"FAQPage"');
    expect(html).toContain('#일산 ABA'); // tag chip → tag page link
    expect(html).toContain('og:image');
  });

  it('returns null for an unknown slug (controller turns this into 404)', async () => {
    const { articles, service } = makeService();
    articles.findOne.mockRejectedValue(new Error('not found'));
    expect(await service.articleHtml('missing')).toBeNull();
  });

  it('links the related program when one is set', async () => {
    const { prisma, articles, service } = makeService();
    articles.findOne.mockResolvedValue(article({ relatedProgram: 'prog-1', faqItems: [] }));
    prisma.program.findMany.mockResolvedValue([
      { id: 'prog-1', title: '조기교실', desc: '소그룹' },
    ]);
    const html = (await service.articleHtml('ilsan-aba-guide')) as string;
    expect(html).toContain('관련 프로그램');
    expect(html).toContain('#program-prog-1');
  });
});

describe('SeoService.tagHtml', () => {
  const tagView = (over: Record<string, unknown> = {}) => ({
    id: 't1',
    name: '일산 ABA',
    slug: 'ilsan-aba',
    description: '일산 지역 정보',
    seoTitle: null,
    seoDescription: null,
    indexable: false,
    articleCount: 1,
    ...over,
  });

  it('marks thin tag pages noindex and lists their posts', async () => {
    const { prisma, tags, service } = makeService();
    tags.findOne.mockResolvedValue(tagView());
    prisma.article.findMany.mockResolvedValue([
      { slug: 'p1', title: '글 1', excerpt: '', publishedAt: new Date() },
    ]);
    prisma.article.count.mockResolvedValue(1);
    const html = (await service.tagHtml('ilsan-aba')) as string;
    expect(html).toContain('noindex,follow');
    expect(html).toContain('글 1');
  });

  it('omits the robots meta once the tag is indexable', async () => {
    const { tags, service } = makeService();
    tags.findOne.mockResolvedValue(tagView({ indexable: true }));
    const html = (await service.tagHtml('ilsan-aba')) as string;
    expect(html).not.toContain('noindex');
  });

  it('returns null for an unknown tag', async () => {
    const { tags, service } = makeService();
    tags.findOne.mockRejectedValue(new Error('not found'));
    expect(await service.tagHtml('missing')).toBeNull();
  });
});

describe('SeoService.blogIndexHtml', () => {
  it('renders the list with pagination when there are multiple pages', async () => {
    const { articles, service } = makeService();
    articles.list.mockResolvedValue({
      items: [article({ category: { name: 'ABA 전문 정보' } })],
      page: 1,
      pageSize: 20,
      total: 45,
    });
    const html = await service.blogIndexHtml(1);
    expect(html).toContain('소식·블로그');
    expect(html).toContain('일산 ABA 센터 선택 가이드');
    expect(html).toContain('/blog?page=2'); // pager
  });
});

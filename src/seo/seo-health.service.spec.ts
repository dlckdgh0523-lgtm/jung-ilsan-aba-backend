import { SeoHealthService, countImgsWithoutAlt } from './seo-health.service';

function makeService(overrides: Partial<Record<string, unknown>> = {}) {
  const prisma = {
    article: {
      findMany: jest.fn().mockResolvedValue(overrides.published ?? []),
      count: jest.fn().mockResolvedValue(overrides.draftCount ?? 0),
    },
    tag: { count: jest.fn().mockResolvedValue(overrides.tagCount ?? 0) },
    faqItem: { count: jest.fn().mockResolvedValue(overrides.faqCount ?? 5) },
  };
  const tags = {
    indexableTags: jest.fn().mockResolvedValue(overrides.indexableTags ?? []),
  };
  return { service: new SeoHealthService(prisma as never, tags as never), prisma };
}

const post = (over: Record<string, unknown> = {}) => ({
  slug: 'aba-guide',
  title: 'ABA란 무엇인가',
  seoTitle: null,
  seoDescription: '응용행동분석 소개',
  excerpt: '요약',
  thumbnail: 'https://cdn/img.png',
  content: `<p>${'본문 '.repeat(80)}</p><p><a href="/blog/other">관련 글</a></p>`,
  categoryId: 'c1',
  relatedLocations: ['고양시'],
  relatedPrograms: ['p1'],
  tags: [{ tagId: 't1' }],
  ...over,
});

describe('SeoHealthService.report', () => {
  it('a healthy post produces no errors or warnings', async () => {
    const { service } = makeService({ published: [post()] });
    const r = await service.report();
    expect(r.errors).toHaveLength(0);
    expect(r.warnings).toHaveLength(0);
    expect(r.totals.published).toBe(1);
  });

  it('flags missing description and thin content as ERRORS', async () => {
    const { service } = makeService({
      published: [post({ seoDescription: null, excerpt: null, content: '<p>짧음</p>' })],
    });
    const r = await service.report();
    const messages = r.errors.map((e) => e.message).join(' | ');
    expect(messages).toContain('Meta Description');
    expect(messages).toContain('본문이 너무 짧음');
    expect(r.totals.errors).toBe(2);
  });

  it('flags duplicate titles across published posts', async () => {
    const { service } = makeService({
      published: [post(), post({ slug: 'another' })],
    });
    const r = await service.report();
    expect(r.errors.some((e) => e.message.includes('중복 제목'))).toBe(true);
  });

  it('flags missing thumbnail, alt-less images and 지역글 미연결 as WARNINGS', async () => {
    const { service } = makeService({
      published: [
        post({
          slug: 'ilsan-post',
          title: '일산 부모교육 안내',
          thumbnail: null,
          relatedLocations: [],
          content: `<p>${'일산 지역 안내 '.repeat(40)}</p><img src="/a.png"><p><a href="/blog/x">글</a></p>`,
        }),
      ],
    });
    const r = await service.report();
    const messages = r.warnings.map((w) => w.message).join(' | ');
    expect(messages).toContain('대표 이미지 없음');
    expect(messages).toContain('alt 없는 이미지 1개');
    expect(messages).toContain('관련 지역이 연결되지 않음');
    expect(r.errors).toHaveLength(0);
  });

  it('reports drafts and thin tags as info, empty FAQ as warning', async () => {
    const { service } = makeService({
      published: [],
      draftCount: 3,
      tagCount: 10,
      indexableTags: [{ slug: 'a' }, { slug: 'b' }],
      faqCount: 0,
    });
    const r = await service.report();
    expect(r.info.join(' ')).toContain('초안 3건');
    expect(r.info.join(' ')).toContain('색인 대상 2개');
    expect(r.totals.tagsThin).toBe(8);
    expect(r.warnings.some((w) => w.message.includes('FAQ'))).toBe(true);
  });
});

describe('countImgsWithoutAlt', () => {
  it('counts only imgs lacking a non-empty alt', () => {
    expect(countImgsWithoutAlt('<img src="a"><img src="b" alt="설명"><img alt="" src="c">')).toBe(
      2,
    );
    expect(countImgsWithoutAlt('본문에 이미지 없음')).toBe(0);
  });
});

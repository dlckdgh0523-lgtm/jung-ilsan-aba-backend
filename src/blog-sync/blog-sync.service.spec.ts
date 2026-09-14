import { BlogSyncService } from './blog-sync.service';
import type { BlogRssItem, ParsedPost } from './blog-sync.types';

/** All collaborators mocked — no network, no DB. */
function makeService(overrides: Partial<Record<string, unknown>> = {}) {
  const settings = {
    enabled: true,
    blogId: 'ilsanaba',
    cron: '*/30 * * * *',
    categories: [] as string[],
    maxPerRun: 5,
    since: '2026-01-01',
    fetchTimeoutMs: 1000,
    ...((overrides.settings as object) ?? {}),
  };

  const items: BlogRssItem[] = (overrides.items as BlogRssItem[]) ?? [];
  const parsed: ParsedPost = {
    title: 't',
    bodyHtml: '<p>본문</p>',
    imageUrls: [],
    dropped: [],
  };

  const prisma = {
    blogSyncRun: {
      create: jest.fn().mockResolvedValue({ id: 'run1', startedAt: new Date() }),
      update: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    article: {
      findMany: jest.fn().mockResolvedValue(overrides.existingArticles ?? []),
      findFirst: jest.fn().mockResolvedValue(overrides.slugTaken ?? null),
    },
    articleCategory: {
      findFirst: jest.fn().mockResolvedValue(overrides.existingCategory ?? null),
      findMany: jest
        .fn()
        .mockResolvedValue(
          ((overrides.siteCategories as string[]) ?? []).map((name) => ({ name })),
        ),
      create: jest.fn().mockResolvedValue({ id: 'cat-new' }),
    },
  };
  const rss = { fetchItems: jest.fn().mockResolvedValue(items) };
  const fetcher = { fetchPost: jest.fn().mockResolvedValue(parsed) };
  const mirror = {
    mirrorImages: jest
      .fn()
      .mockResolvedValue({ html: '<p>본문</p>', firstImageUrl: null, mirrored: 0, failed: 0 }),
  };
  const articles = {
    create: jest
      .fn()
      .mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve({ id: `a_${String(data.sourceId)}`, tags: [], category: null, ...data }),
      ),
  };
  const realtime = { emitBlogSynced: jest.fn() };
  const reviews = {
    issue: jest.fn().mockImplementation((articleId: string) =>
      Promise.resolve({
        token: 'tok-' + articleId,
        review: { id: 'rev-' + articleId, expiresAt: new Date() },
      }),
    ),
  };
  const alimtalk = {
    enabled: overrides.alimtalkEnabled ?? false,
    sendReviewRequest: jest.fn().mockResolvedValue({ sent: 1, failed: 0, results: [] }),
  };
  const transformer = (overrides.transformer as {
    transform: (p: ParsedPost, i: BlogRssItem) => ParsedPost;
  }) ?? {
    transform: (p: ParsedPost) => p,
  };
  const config = { get: jest.fn().mockReturnValue(settings) };

  // prisma.article.findUnique is used by notifyReview.
  (prisma.article as Record<string, jest.Mock>).findUnique = jest
    .fn()
    .mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({ id: where.id, title: '글', publishedAt: new Date() }),
    );

  const geoReview = { active: false, analyzeAndStore: jest.fn().mockResolvedValue(undefined) };
  const service = new BlogSyncService(
    prisma as never,
    rss as never,
    fetcher as never,
    mirror as never,
    articles as never,
    realtime as never,
    reviews as never,
    alimtalk as never,
    geoReview as never,
    transformer as never,
    config as never,
  );
  return { service, prisma, rss, fetcher, mirror, articles, realtime, reviews, alimtalk, settings };
}

const item = (logNo: string, publishedAt: string, category = '공지'): BlogRssItem => ({
  logNo,
  url: `https://blog.naver.com/ilsanaba/${logNo}`,
  title: `글 ${logNo}`,
  category,
  publishedAt: new Date(publishedAt),
});

describe('BlogSyncService.run (imports as draft articles)', () => {
  it('imports new posts as DRAFT articles with source fields and the blog publish date', async () => {
    const { service, articles, realtime } = makeService({
      items: [item('100', '2026-08-05T06:55:58Z')],
    });
    const summary = await service.run('manual');

    expect(summary).toMatchObject({ status: 'ok', fetched: 1, created: 1, skipped: 0 });
    expect(articles.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '글 100',
        status: 'draft',
        visible: true,
        slug: '글-100',
        // Blog date pre-set so publishing keeps the real chronology.
        publishedAt: new Date('2026-08-05T06:55:58Z'),
        sourceUrl: 'https://blog.naver.com/ilsanaba/100',
        sourceId: '100',
      }),
    );
    const content = (articles.create.mock.calls[0][0] as { content: string }).content;
    expect(content).toContain('네이버 블로그 원문 보기');
    expect(content).toContain('https://blog.naver.com/ilsanaba/100');
    expect(realtime.emitBlogSynced).toHaveBeenCalledWith(expect.objectContaining({ created: 1 }));
  });

  it('creates the article category from the Naver category on first sight', async () => {
    const { service, prisma, articles } = makeService({
      items: [item('100', '2026-08-05T00:00:00Z', '부모교육')],
    });
    await service.run('manual');
    expect(prisma.articleCategory.create).toHaveBeenCalledWith({
      data: { name: '부모교육', slug: '부모교육' },
    });
    expect(articles.create).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 'cat-new' }),
    );
  });

  it('reuses an existing article category by name', async () => {
    const { service, prisma, articles } = makeService({
      items: [item('100', '2026-08-05T00:00:00Z', '공지')],
      existingCategory: { id: 'cat-1' },
    });
    await service.run('manual');
    expect(prisma.articleCategory.create).not.toHaveBeenCalled();
    expect(articles.create).toHaveBeenCalledWith(expect.objectContaining({ categoryId: 'cat-1' }));
  });

  it('appends the logNo when the title slug is already taken', async () => {
    const { service, articles } = makeService({
      items: [item('100', '2026-08-05T00:00:00Z')],
      slugTaken: { id: 'other' },
    });
    await service.run('manual');
    expect(articles.create).toHaveBeenCalledWith(expect.objectContaining({ slug: '글-100-100' }));
  });

  it('skips posts published before the cutoff', async () => {
    const { service, articles } = makeService({
      items: [item('old', '2025-12-31T00:00:00Z'), item('new', '2026-06-01T00:00:00Z')],
    });
    const summary = await service.run('manual');
    expect(summary.created).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(articles.create).toHaveBeenCalledTimes(1);
  });

  it('skips posts whose category is not allowlisted', async () => {
    const { service } = makeService({
      settings: { categories: ['공지', '센터소식'] },
      items: [item('1', '2026-06-01T00:00:00Z', '공지'), item('2', '2026-06-01T00:00:00Z', '일상')],
    });
    const summary = await service.run('manual');
    expect(summary).toMatchObject({ created: 1, skipped: 1 });
  });

  it('never re-imports an already-known sourceUrl (soft-deleted included)', async () => {
    const { service, prisma, articles } = makeService({
      items: [item('100', '2026-06-01T00:00:00Z')],
      existingArticles: [{ sourceUrl: 'https://blog.naver.com/ilsanaba/100' }],
    });
    const summary = await service.run('manual');
    expect(summary).toMatchObject({ created: 0, skipped: 1 });
    expect(articles.create).not.toHaveBeenCalled();
    // Dedupe query must not filter on deletedAt — deleted articles stay deleted.
    const where = prisma.article.findMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where).not.toHaveProperty('deletedAt');
  });

  it('caps a run at maxPerRun, oldest first, and reports the rest as deferred', async () => {
    const { service, articles } = makeService({
      settings: { maxPerRun: 2 },
      items: [
        item('3', '2026-06-03T00:00:00Z'),
        item('1', '2026-06-01T00:00:00Z'),
        item('2', '2026-06-02T00:00:00Z'),
      ],
    });
    const summary = await service.run('manual');
    expect(summary).toMatchObject({ created: 2, deferred: 1 });
    const created = articles.create.mock.calls.map((c) => (c[0] as { sourceId: string }).sourceId);
    expect(created).toEqual(['1', '2']);
  });

  it('continues past a single failed post and records the failure', async () => {
    const { service, fetcher } = makeService({
      items: [item('1', '2026-06-01T00:00:00Z'), item('2', '2026-06-02T00:00:00Z')],
    });
    fetcher.fetchPost.mockRejectedValueOnce(new Error('파서 깨짐'));
    const summary = await service.run('manual');
    expect(summary.created).toBe(1);
    expect(summary.failures).toHaveLength(1);
    expect(summary.failures[0]).toContain('파서 깨짐');
    expect(summary.status).toBe('ok');
  });

  it('rejects concurrent runs with a conflict', async () => {
    const { service, rss } = makeService({ items: [] });
    let release!: () => void;
    rss.fetchItems.mockReturnValue(new Promise((r) => (release = () => r([]))));
    const first = service.run('manual');
    await expect(service.run('manual')).rejects.toMatchObject({ status: 409 });
    release();
    await first;
  });

  it('marks the run as error when RSS itself fails', async () => {
    const { service, prisma, rss } = makeService({ items: [] });
    rss.fetchItems.mockRejectedValue(new Error('RSS down'));
    await expect(service.run('cron')).rejects.toThrow('RSS down');
    expect(prisma.blogSyncRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'error' }) }),
    );
  });

  it('refuses to run without a blogId', async () => {
    const { service } = makeService({ settings: { blogId: '' } });
    await expect(service.run('manual')).rejects.toMatchObject({ status: 400 });
  });

  it('applies the LLM clean title as Article.title and keeps the original in sourceTitle', async () => {
    const { service, articles } = makeService({
      items: [item('100', '2026-08-05T00:00:00Z')],
      transformer: {
        transform: (p: ParsedPost) => ({ ...p, cleanTitle: '9월 부모교육 안내', summary: '요약.' }),
      },
    });
    await service.run('manual');
    expect(articles.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: '9월 부모교육 안내', sourceTitle: '글 100' }),
    );
  });

  it('passes the site category list to the transformer and prefers its validated pick', async () => {
    const transform = jest
      .fn()
      .mockImplementation((p: ParsedPost) => ({ ...p, categoryName: '센터소식' }));
    const { service, prisma, articles } = makeService({
      items: [item('100', '2026-08-05T00:00:00Z', '공지')],
      siteCategories: ['센터소식', '부모교육'],
      existingCategory: { id: 'cat-center' },
      transformer: { transform },
    });
    await service.run('manual');
    // Transformer got the site's categories …
    expect(transform).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ categories: ['센터소식', '부모교육'] }),
    );
    // … and its pick (센터소식), not the Naver name (공지), drove the lookup.
    expect(prisma.articleCategory.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ name: '센터소식' }) }),
    );
    expect(articles.create).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 'cat-center' }),
    );
  });

  it('sends the review alimtalk per created article and counts notified', async () => {
    const { service, reviews, alimtalk } = makeService({
      items: [item('1', '2026-06-01T00:00:00Z'), item('2', '2026-06-02T00:00:00Z')],
      alimtalkEnabled: true,
    });
    const summary = await service.run('manual');
    expect(reviews.issue).toHaveBeenCalledTimes(2);
    expect(alimtalk.sendReviewRequest).toHaveBeenCalledTimes(2);
    expect(summary).toMatchObject({ created: 2, notified: 2, notifyFailed: 0 });
  });

  it('a failed alimtalk keeps the article and only bumps notifyFailed', async () => {
    const { service, alimtalk } = makeService({
      items: [item('1', '2026-06-01T00:00:00Z')],
      alimtalkEnabled: true,
    });
    alimtalk.sendReviewRequest.mockResolvedValue({ sent: 0, failed: 1, results: [] });
    const summary = await service.run('manual');
    expect(summary).toMatchObject({ created: 1, notified: 0, notifyFailed: 1, status: 'ok' });
  });

  it('still issues the review row (silently) when alimtalk is disabled', async () => {
    const { service, reviews, alimtalk } = makeService({
      items: [item('1', '2026-06-01T00:00:00Z')],
      alimtalkEnabled: false,
    });
    const summary = await service.run('manual');
    expect(reviews.issue).toHaveBeenCalledTimes(1);
    expect(alimtalk.sendReviewRequest).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ created: 1, notified: 0, notifyFailed: 0 });
  });

  it('uses the first run startedAt as cutoff when BLOG_SYNC_SINCE is empty', async () => {
    const { service, prisma, articles } = makeService({
      settings: { since: '' },
      items: [item('1', '2026-06-01T00:00:00Z')],
    });
    // First-ever run happened after the post → the post is skipped, not imported.
    prisma.blogSyncRun.findFirst.mockResolvedValue({ startedAt: new Date('2026-07-01T00:00:00Z') });
    const summary = await service.run('manual');
    expect(summary).toMatchObject({ created: 0, skipped: 1 });
    expect(articles.create).not.toHaveBeenCalled();
  });
});

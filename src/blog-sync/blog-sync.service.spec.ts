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
    notice: {
      findMany: jest.fn().mockResolvedValue(overrides.existingNotices ?? []),
    },
  };
  const rss = { fetchItems: jest.fn().mockResolvedValue(items) };
  const fetcher = { fetchPost: jest.fn().mockResolvedValue(parsed) };
  const mirror = {
    mirrorImages: jest
      .fn()
      .mockResolvedValue({ html: '<p>본문</p>', firstImageUrl: null, mirrored: 0, failed: 0 }),
  };
  const notices = {
    create: jest
      .fn()
      .mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve({ id: `n_${String(data.sourceId)}`, ...data }),
      ),
  };
  const realtime = { emitNoticeSynced: jest.fn() };
  const transformer = { transform: (p: ParsedPost) => p };
  const config = { get: jest.fn().mockReturnValue(settings) };

  const service = new BlogSyncService(
    prisma as never,
    rss as never,
    fetcher as never,
    mirror as never,
    notices as never,
    realtime as never,
    transformer as never,
    config as never,
  );
  return { service, prisma, rss, fetcher, mirror, notices, realtime, settings };
}

const item = (logNo: string, publishedAt: string, category = '공지'): BlogRssItem => ({
  logNo,
  url: `https://blog.naver.com/ilsanaba/${logNo}`,
  title: `글 ${logNo}`,
  category,
  publishedAt: new Date(publishedAt),
});

describe('BlogSyncService.run', () => {
  it('imports new posts as hidden notices with source fields and KST date', async () => {
    const { service, notices, realtime } = makeService({
      items: [item('100', '2026-08-05T06:55:58Z')],
    });
    const summary = await service.run('manual');

    expect(summary).toMatchObject({ status: 'ok', fetched: 1, created: 1, skipped: 0 });
    expect(notices.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '글 100',
        visible: false,
        pinned: false,
        date: '2026.08.05',
        sourceUrl: 'https://blog.naver.com/ilsanaba/100',
        sourceId: '100',
      }),
    );
    const body = (notices.create.mock.calls[0][0] as { body: string }).body;
    expect(body).toContain('네이버 블로그 원문 보기');
    expect(body).toContain('https://blog.naver.com/ilsanaba/100');
    expect(realtime.emitNoticeSynced).toHaveBeenCalledWith(expect.objectContaining({ created: 1 }));
  });

  it('skips posts published before the cutoff', async () => {
    const { service, notices } = makeService({
      items: [item('old', '2025-12-31T00:00:00Z'), item('new', '2026-06-01T00:00:00Z')],
    });
    const summary = await service.run('manual');
    expect(summary.created).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(notices.create).toHaveBeenCalledTimes(1);
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
    const { service, prisma, notices } = makeService({
      items: [item('100', '2026-06-01T00:00:00Z')],
      existingNotices: [{ sourceUrl: 'https://blog.naver.com/ilsanaba/100' }],
    });
    const summary = await service.run('manual');
    expect(summary).toMatchObject({ created: 0, skipped: 1 });
    expect(notices.create).not.toHaveBeenCalled();
    // Dedupe query must not filter on deletedAt — deleted notices stay deleted.
    const where = prisma.notice.findMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where).not.toHaveProperty('deletedAt');
  });

  it('caps a run at maxPerRun, oldest first, and reports the rest as deferred', async () => {
    const { service, notices } = makeService({
      settings: { maxPerRun: 2 },
      items: [
        item('3', '2026-06-03T00:00:00Z'),
        item('1', '2026-06-01T00:00:00Z'),
        item('2', '2026-06-02T00:00:00Z'),
      ],
    });
    const summary = await service.run('manual');
    expect(summary).toMatchObject({ created: 2, deferred: 1 });
    const created = notices.create.mock.calls.map((c) => (c[0] as { sourceId: string }).sourceId);
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

  it('uses the first run startedAt as cutoff when BLOG_SYNC_SINCE is empty', async () => {
    const { service, prisma, notices } = makeService({
      settings: { since: '' },
      items: [item('1', '2026-06-01T00:00:00Z')],
    });
    // First-ever run happened after the post → the post is skipped, not imported.
    prisma.blogSyncRun.findFirst.mockResolvedValue({ startedAt: new Date('2026-07-01T00:00:00Z') });
    const summary = await service.run('manual');
    expect(summary).toMatchObject({ created: 0, skipped: 1 });
    expect(notices.create).not.toHaveBeenCalled();
  });
});

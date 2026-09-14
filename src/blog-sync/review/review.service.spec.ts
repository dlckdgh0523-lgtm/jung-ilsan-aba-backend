import { createHash } from 'node:crypto';
import { ReviewService } from './review.service';

function makeService(overrides: Partial<Record<string, unknown>> = {}) {
  const now = Date.now();
  const article = {
    id: 'a1',
    title: '정리된 제목',
    sourceTitle: '일산ABA 원래 제목',
    status: 'draft',
    deletedAt: null,
    publishedAt: new Date('2026-08-05T00:00:00Z'),
    content: '<p>본문</p>',
    ...((overrides.article as object) ?? {}),
  };
  const review = {
    id: 'r1',
    articleId: 'a1',
    tokenHash: 'HASH',
    summary: '요약',
    expiresAt: new Date(now + 86400_000),
    decidedAt: null,
    decision: null,
    article,
    ...((overrides.review as object) ?? {}),
  };
  const prisma = {
    articleReview: {
      findUnique: jest.fn().mockResolvedValue(overrides.noReview ? null : review),
      upsert: jest
        .fn()
        .mockImplementation(({ create, update }) =>
          Promise.resolve({ ...review, ...create, ...update }),
        ),
      update: jest
        .fn()
        .mockImplementation(({ data }) => Promise.resolve({ ...review, ...data, article })),
    },
    article: {
      update: jest.fn().mockResolvedValue(article),
    },
  };
  const config = {
    get: jest.fn().mockReturnValue({ secret: 'pepper-secret', ttlDays: 7 }),
  };
  const service = new ReviewService(prisma as never, config as never);
  return { service, prisma, article, review };
}

describe('ReviewService', () => {
  it('issue() returns a one-time token and stores only its salted SHA-256 hash', async () => {
    const { service, prisma } = makeService({ noReview: true });
    const { token } = await service.issue('a1', '요약');
    expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/); // 32 bytes base64url
    const upsert = prisma.articleReview.upsert.mock.calls[0][0] as {
      create: { tokenHash: string; expiresAt: Date };
    };
    const expected = createHash('sha256')
      .update(token + 'pepper-secret')
      .digest('hex');
    expect(upsert.create.tokenHash).toBe(expected);
    expect(upsert.create.tokenHash).not.toContain(token);
    // TTL ≈ 7 days
    const ttlMs = upsert.create.expiresAt.getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(6.9 * 86400_000);
    expect(ttlMs).toBeLessThan(7.1 * 86400_000);
  });

  it('issue() rotates the hash on resend (old link dies) but refuses after a decision', async () => {
    const { service, prisma } = makeService();
    await service.issue('a1');
    expect(prisma.articleReview.upsert).toHaveBeenCalled();

    const decided = makeService({ review: { decidedAt: new Date(), decision: 'hold' } });
    await expect(decided.service.issue('a1')).rejects.toMatchObject({ status: 409 });
  });

  it('findByToken() → invalid for an unknown token', async () => {
    const { service } = makeService({ noReview: true });
    await expect(service.findByToken('nope')).resolves.toEqual({ kind: 'invalid' });
  });

  it('findByToken() → expired past expiresAt', async () => {
    const { service } = makeService({ review: { expiresAt: new Date(Date.now() - 1000) } });
    const state = await service.findByToken('t');
    expect(state.kind).toBe('expired');
  });

  it('findByToken() → decided once used', async () => {
    const { service } = makeService({ review: { decidedAt: new Date(), decision: 'publish' } });
    const state = await service.findByToken('t');
    expect(state.kind).toBe('decided');
  });

  it('findByToken() → handled-elsewhere when the admin already published or deleted', async () => {
    const published = makeService({ article: { status: 'published' } });
    expect((await published.service.findByToken('t')).kind).toBe('handled-elsewhere');
    const deleted = makeService({ article: { deletedAt: new Date() } });
    expect((await deleted.service.findByToken('t')).kind).toBe('handled-elsewhere');
  });

  it('decide(publish) publishes the article and spends the link', async () => {
    const { service, prisma } = makeService();
    const state = await service.decide('t', 'publish', false);
    expect(state.kind).toBe('decided');
    expect(prisma.article.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'a1' },
        data: expect.objectContaining({ status: 'published', visible: true }),
      }),
    );
    // Pre-set blog date is kept — no publishedAt overwrite.
    const data = prisma.article.update.mock.calls[0][0].data as Record<string, unknown>;
    expect(data).not.toHaveProperty('publishedAt');
    expect(prisma.articleReview.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ decision: 'publish', decidedVia: 'kakao-link' }),
      }),
    );
  });

  it('decide(publish, useSourceTitle) restores the original blog title', async () => {
    const { service, prisma } = makeService();
    await service.decide('t', 'publish', true);
    const data = prisma.article.update.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.title).toBe('일산ABA 원래 제목');
  });

  it('decide(hold) records the decision without touching the article', async () => {
    const { service, prisma } = makeService();
    const state = await service.decide('t', 'hold', false);
    expect(state.kind).toBe('decided');
    expect(prisma.article.update).not.toHaveBeenCalled();
    expect(prisma.articleReview.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ decision: 'hold' }) }),
    );
  });

  it('decide() on a spent/expired/foreign token changes nothing', async () => {
    const spent = makeService({ review: { decidedAt: new Date(), decision: 'publish' } });
    const state = await spent.service.decide('t', 'publish', false);
    expect(state.kind).toBe('decided');
    expect(spent.prisma.article.update).not.toHaveBeenCalled();
    expect(spent.prisma.articleReview.update).not.toHaveBeenCalled();
  });
});

import { AlimtalkService } from './alimtalk.service';
import { buildSolapiAuthHeader } from './providers/solapi.provider';

function makeService(overrides: Partial<Record<string, unknown>> = {}) {
  const settings = {
    enabled: true,
    provider: 'solapi',
    apiKey: 'k',
    apiSecret: 's',
    senderKey: 'pf',
    templateReview: 'TPL_REVIEW',
    recipients: ['01011112222', '01033334444'],
    fallbackSms: false,
    ...((overrides.settings as object) ?? {}),
  };
  const provider = {
    send: jest.fn().mockResolvedValue({ providerMessageId: 'M1', status: 'ACCEPTED' }),
    getStatus: jest.fn(),
  };
  const ops = { notify: jest.fn() };
  const prisma = { articleReview: { update: jest.fn().mockResolvedValue({}) } };
  const config = { get: jest.fn().mockReturnValue(settings) };
  const service = new AlimtalkService(provider as never, ops, prisma as never, config as never);
  return { service, provider, ops, prisma };
}

const article = {
  id: 'a1',
  title: '가'.repeat(60), // template variable must be cut to 40
  publishedAt: new Date('2026-08-05T15:00:00+09:00'),
} as never;
const review = { id: 'r1', expiresAt: new Date('2026-09-21T00:00:00+09:00') } as never;

describe('AlimtalkService.sendReviewRequest', () => {
  it('sends the template to every recipient with substituted variables', async () => {
    const { service, provider, prisma } = makeService();
    const outcome = await service.sendReviewRequest(article, review, 'TOKEN123');

    expect(outcome).toMatchObject({ sent: 2, failed: 0 });
    expect(provider.send).toHaveBeenCalledTimes(2);
    const first = provider.send.mock.calls[0][0];
    expect(first).toMatchObject({ to: '01011112222', templateCode: 'TPL_REVIEW' });
    expect(first.variables.title).toBe('가'.repeat(40));
    expect(first.variables.date).toBe('2026.08.05');
    expect(first.variables.expires).toBe('2026.09.21');
    expect(first.variables.token).toBe('TOKEN123');
    // Success recorded on the review row.
    const data = prisma.articleReview.update.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.notifiedAt).toBeInstanceOf(Date);
    expect(data.notifyError).toBeNull();
    expect(data.providerMessageIds).toHaveLength(2);
  });

  it('partial failure: the good recipient stays sent, the bad one lands in notifyError + OpsAlert', async () => {
    const { service, provider, ops, prisma } = makeService();
    provider.send
      .mockResolvedValueOnce({ providerMessageId: 'M1', status: 'ACCEPTED' })
      .mockRejectedValueOnce(new Error('솔라피 발송 실패 (HTTP 402)'));

    const outcome = await service.sendReviewRequest(article, review, 'T');
    expect(outcome).toMatchObject({ sent: 1, failed: 1 });
    const data = prisma.articleReview.update.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.notifiedAt).toBeInstanceOf(Date); // ≥1 success counts as notified
    expect(String(data.notifyError)).toContain('01033334444');
    expect(ops.notify).toHaveBeenCalledWith(
      'error',
      expect.stringContaining('알림톡 발송 실패'),
      expect.anything(),
    );
  });

  it('total failure: notifiedAt stays null and the error is recorded', async () => {
    const { service, provider, prisma } = makeService();
    provider.send.mockRejectedValue(new Error('boom'));
    const outcome = await service.sendReviewRequest(article, review, 'T');
    expect(outcome).toMatchObject({ sent: 0, failed: 2 });
    const data = prisma.articleReview.update.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.notifiedAt).toBeNull();
  });

  it('ALIMTALK_ENABLED=false → complete no-op (no provider call, still records nothing sent)', async () => {
    const { service, provider } = makeService({ settings: { enabled: false } });
    const outcome = await service.sendReviewRequest(article, review, 'T');
    expect(outcome).toEqual({ sent: 0, failed: 0, results: [] });
    expect(provider.send).not.toHaveBeenCalled();
  });

  it('sendTest refuses when disabled', async () => {
    const { service } = makeService({ settings: { enabled: false } });
    await expect(service.sendTest()).rejects.toMatchObject({ status: 400 });
  });
});

describe('buildSolapiAuthHeader', () => {
  it('produces the documented HMAC-SHA256 header shape deterministically', () => {
    const header = buildSolapiAuthHeader('APIKEY', 'SECRET', '2026-09-14T00:00:00Z', 'salt1234');
    expect(header).toMatch(
      /^HMAC-SHA256 apiKey=APIKEY, date=2026-09-14T00:00:00Z, salt=salt1234, signature=[0-9a-f]{64}$/,
    );
    // Same inputs → same signature (HMAC of date+salt with the secret).
    expect(buildSolapiAuthHeader('APIKEY', 'SECRET', '2026-09-14T00:00:00Z', 'salt1234')).toBe(
      header,
    );
    // Different secret → different signature.
    expect(buildSolapiAuthHeader('APIKEY', 'OTHER', '2026-09-14T00:00:00Z', 'salt1234')).not.toBe(
      header,
    );
  });
});

import { PopupsService } from './popups.service';

/** Popup status is computed against KST "today"; tests use clearly past/future dates. */
describe('PopupsService status calculation', () => {
  const service = new PopupsService({ popup: {} } as never);
  const statusOf = (p: Record<string, unknown>): string =>
    (service as unknown as { statusOf: (p: unknown) => string }).statusOf(p);

  it('deleted: deletedAt set wins over everything', () => {
    expect(
      statusOf({
        deletedAt: new Date(),
        isActive: true,
        startAt: '2000-01-01',
        endAt: '2999-12-31',
      }),
    ).toBe('deleted');
  });

  it('inactive: isActive false', () => {
    expect(
      statusOf({ deletedAt: null, isActive: false, startAt: '2000-01-01', endAt: '2999-12-31' }),
    ).toBe('inactive');
  });

  it('scheduled: startAt is in the future', () => {
    expect(
      statusOf({ deletedAt: null, isActive: true, startAt: '2999-01-01', endAt: '2999-12-31' }),
    ).toBe('scheduled');
  });

  it('ended: endAt is in the past', () => {
    expect(
      statusOf({ deletedAt: null, isActive: true, startAt: '2000-01-01', endAt: '2000-12-31' }),
    ).toBe('ended');
  });

  it('active: within [startAt, endAt] and active', () => {
    expect(
      statusOf({ deletedAt: null, isActive: true, startAt: '2000-01-01', endAt: '2999-12-31' }),
    ).toBe('active');
  });
});

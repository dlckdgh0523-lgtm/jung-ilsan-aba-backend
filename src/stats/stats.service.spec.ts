import { StatsService } from './stats.service';

describe('StatsService', () => {
  let service: StatsService;
  let prisma: {
    pageView: { groupBy: jest.Mock; count: jest.Mock; create: jest.Mock; findMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      pageView: {
        groupBy: jest.fn().mockResolvedValue([{ session: 's1' }, { session: 's2' }]),
        count: jest.fn().mockResolvedValue(5),
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const config = { get: () => ({ concurrentWindowSeconds: 90 }) };
    service = new StatsService(prisma as never, config as never);
  });

  it('summary maps online/today/total + windowSeconds', async () => {
    const s = await service.summary();
    expect(s.online).toBe(2); // distinct sessions in window
    expect(s.today).toEqual({ visits: 5, visitors: 2 });
    expect(s.total).toEqual({ visits: 5, visitors: 2 });
    expect(s.windowSeconds).toBe(90);
    expect(typeof s.at).toBe('string');
  });

  it('recordHit defaults + persists a page view', async () => {
    const r = await service.recordHit({ path: '/contact', session: 'sess-1' }, '1.1.1.1');
    expect(r).toEqual({ ok: true });
    expect(prisma.pageView.create).toHaveBeenCalledWith({
      data: { path: '/contact', session: 'sess-1' },
    });
  });

  it('recordHit falls back to ip then "anonymous" for session, "/" for path', async () => {
    await service.recordHit({}, '9.9.9.9');
    expect(prisma.pageView.create).toHaveBeenCalledWith({
      data: { path: '/', session: '9.9.9.9' },
    });
  });

  it('range clamps the span and returns one zero-seeded bucket per day', async () => {
    const pts = await service.range(7);
    expect(pts).toHaveLength(7);
    expect(pts[0]).toMatchObject({ visits: 0, visitors: 0 });
    expect(pts[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

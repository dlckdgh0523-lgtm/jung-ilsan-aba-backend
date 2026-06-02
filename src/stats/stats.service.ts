import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AppConfig } from '../config/configuration';
import { CreateHitDto } from './dto/create-hit.dto';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface StatsSummary {
  /** Distinct sessions seen within the concurrent window. */
  online: number;
  today: { visits: number; visitors: number };
  total: { visits: number; visitors: number };
  windowSeconds: number;
  at: string;
}

export interface StatsRangePoint {
  date: string;
  visits: number;
  visitors: number;
}

@Injectable()
export class StatsService {
  private readonly windowSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.windowSeconds = config.get('stats', { infer: true }).concurrentWindowSeconds;
  }

  async recordHit(dto: CreateHitDto, ip?: string): Promise<{ ok: true }> {
    const session = (dto.session?.trim() || ip || 'anonymous').slice(0, 200);
    const path = (dto.path?.trim() || '/').slice(0, 500);
    await this.prisma.pageView.create({ data: { path, session } });
    return { ok: true };
  }

  async summary(): Promise<StatsSummary> {
    const onlineSince = new Date(Date.now() - this.windowSeconds * 1000);
    const todayStart = this.kstDayStartUtc(0);
    const [online, todayVisits, todayVisitors, totalVisits, totalVisitors] = await Promise.all([
      this.distinctSessions({ createdAt: { gte: onlineSince } }),
      this.prisma.pageView.count({ where: { createdAt: { gte: todayStart } } }),
      this.distinctSessions({ createdAt: { gte: todayStart } }),
      this.prisma.pageView.count(),
      this.distinctSessions({}),
    ]);
    return {
      online,
      today: { visits: todayVisits, visitors: todayVisitors },
      total: { visits: totalVisits, visitors: totalVisitors },
      windowSeconds: this.windowSeconds,
      at: new Date().toISOString(),
    };
  }

  async range(days: number): Promise<StatsRangePoint[]> {
    const span = Math.min(Math.max(Math.trunc(days), 1), 90);
    const start = this.kstDayStartUtc(-(span - 1));
    const rows = await this.prisma.pageView.findMany({
      where: { createdAt: { gte: start } },
      select: { session: true, createdAt: true },
    });

    const buckets = new Map<string, { visits: number; visitors: Set<string> }>();
    for (let i = 0; i < span; i++) {
      buckets.set(this.kstDateKey(this.kstDayStartUtc(-(span - 1) + i)), {
        visits: 0,
        visitors: new Set(),
      });
    }
    for (const r of rows) {
      const key = this.kstDateKey(r.createdAt);
      const b = buckets.get(key) ?? { visits: 0, visitors: new Set<string>() };
      b.visits += 1;
      b.visitors.add(r.session);
      buckets.set(key, b);
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, b]) => ({ date, visits: b.visits, visitors: b.visitors.size }));
  }

  private async distinctSessions(where: Prisma.PageViewWhereInput): Promise<number> {
    const groups = await this.prisma.pageView.groupBy({ by: ['session'], where });
    return groups.length;
  }

  /** UTC instant of KST midnight, `offsetDays` from today (negative = past). */
  private kstDayStartUtc(offsetDays: number): Date {
    const kstNow = Date.now() + KST_OFFSET_MS;
    const kstMidnight = Math.floor(kstNow / DAY_MS) * DAY_MS + offsetDays * DAY_MS;
    return new Date(kstMidnight - KST_OFFSET_MS);
  }

  private kstDateKey(d: Date): string {
    return new Date(d.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
  }
}

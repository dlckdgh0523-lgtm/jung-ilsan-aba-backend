import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface BotVisitSummary {
  days: number;
  since: string;
  total: number;
  byBot: { bot: string; count: number; lastAt: Date | null }[];
  recent: { bot: string; path: string; ip: string | null; createdAt: Date }[];
}

@Injectable()
export class BotVisitsService {
  private readonly logger = new Logger(BotVisitsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** fire-and-forget — 방문 기록 실패가 응답에 영향을 주면 안 된다. */
  record(bot: string, userAgent: string, path: string, ip?: string): void {
    void this.prisma.botVisit
      .create({
        data: { bot, userAgent: userAgent.slice(0, 500), path: path.slice(0, 500), ip },
      })
      .catch((e: unknown) => this.logger.warn(`bot visit 기록 실패: ${String(e)}`));
  }

  async summary(days = 30): Promise<BotVisitSummary> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [groups, recent, total] = await Promise.all([
      this.prisma.botVisit.groupBy({
        by: ['bot'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      this.prisma.botVisit.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { bot: true, path: true, ip: true, createdAt: true },
      }),
      this.prisma.botVisit.count({ where: { createdAt: { gte: since } } }),
    ]);
    return {
      days,
      since: since.toISOString(),
      total,
      byBot: groups
        .map((g) => ({ bot: g.bot, count: g._count._all, lastAt: g._max.createdAt }))
        .sort((a, b) => b.count - a.count),
      recent,
    };
  }
}

import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlogSyncRun, Notice } from '@prisma/client';
import { AppException } from '../common/exceptions/app.exception';
import type { AppConfig } from '../config/configuration';
import { NoticesService } from '../notices/notices.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { POST_TRANSFORMER, type BlogRssItem, type PostTransformer } from './blog-sync.types';
import { toKstDisplayDate, truncateHtmlBlocks } from './blog-sync.util';
import { normalizeNoticeHtml } from './html-normalizer';
import { ImageMirrorService } from './image-mirror.service';
import { NaverPostFetcher } from './naver-post.fetcher';
import { NaverRssClient } from './naver-rss.client';

/** DB column is TEXT (unbounded); this is a deliberate product cap, not a DTO one. */
const BODY_MAX_CHARS = 60000;
/** Operational history to keep. The oldest run is also kept — see pruneRuns. */
const RUNS_TO_KEEP = 100;

export interface SyncSummary {
  runId: string;
  status: 'ok' | 'error';
  fetched: number;
  created: number;
  skipped: number;
  /** Eligible but beyond maxPerRun — picked up by the next run. */
  deferred: number;
  failures: string[];
  createdTitles: string[];
}

@Injectable()
export class BlogSyncService {
  private readonly logger = new Logger(BlogSyncService.name);
  /** In-memory lock — single instance deployment (same assumption as RealtimeService). */
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rss: NaverRssClient,
    private readonly fetcher: NaverPostFetcher,
    private readonly mirror: ImageMirrorService,
    private readonly notices: NoticesService,
    private readonly realtime: RealtimeService,
    @Inject(POST_TRANSFORMER) private readonly transformer: PostTransformer,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  private get settings() {
    return this.config.get('blogSync', { infer: true });
  }

  async run(trigger: 'cron' | 'manual'): Promise<SyncSummary> {
    const { blogId, categories, maxPerRun } = this.settings;
    if (!blogId) {
      throw AppException.badRequest(
        'NAVER_BLOG_ID가 설정되지 않았습니다.',
        'BLOG_SYNC_NOT_CONFIGURED',
      );
    }
    if (this.running) {
      throw AppException.conflict('블로그 동기화가 이미 실행 중입니다.', 'BLOG_SYNC_IN_PROGRESS');
    }
    this.running = true;

    const cutoff = await this.resolveCutoff();
    const run = await this.prisma.blogSyncRun.create({
      data: { startedAt: new Date(), status: 'running' },
    });
    this.logger.log(`블로그 동기화 시작 (${trigger}, cutoff=${cutoff.toISOString()})`);

    try {
      const summary = await this.execute(run.id, cutoff, categories, maxPerRun);
      await this.pruneRuns();
      return summary;
    } catch (e) {
      // Run-level failure (RSS unreachable etc.) — record and rethrow.
      const message = e instanceof Error ? e.message : String(e);
      await this.prisma.blogSyncRun.update({
        where: { id: run.id },
        data: { status: 'error', finishedAt: new Date(), error: message.slice(0, 2000) },
      });
      throw e;
    } finally {
      this.running = false;
    }
  }

  private async execute(
    runId: string,
    cutoff: Date,
    categories: string[],
    maxPerRun: number,
  ): Promise<SyncSummary> {
    const items = await this.rss.fetchItems(this.settings.blogId);

    // Skip: before the cutoff, category not allowlisted, or already imported —
    // including soft-deleted notices, so an admin's delete is never undone.
    const fresh = items.filter((i) => i.publishedAt >= cutoff);
    const allowed =
      categories.length > 0 ? fresh.filter((i) => categories.includes(i.category)) : fresh;
    const existing = await this.prisma.notice.findMany({
      where: { sourceUrl: { in: allowed.map((i) => i.url) } },
      select: { sourceUrl: true },
    });
    const known = new Set(existing.map((n) => n.sourceUrl));
    const eligible = allowed
      .filter((i) => !known.has(i.url))
      .sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());

    const batch = eligible.slice(0, maxPerRun);
    const skipped = items.length - eligible.length;
    const failures: string[] = [];
    const createdNotices: Notice[] = [];

    for (const item of batch) {
      try {
        createdNotices.push(await this.importOne(item));
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        this.logger.error(`글 가져오기 실패 (logNo=${item.logNo}): ${message}`);
        failures.push(`${item.logNo}: ${message}`);
      }
    }

    await this.prisma.blogSyncRun.update({
      where: { id: runId },
      data: {
        status: 'ok',
        finishedAt: new Date(),
        fetched: items.length,
        created: createdNotices.length,
        skipped,
        error: failures.length > 0 ? failures.join('\n').slice(0, 2000) : null,
      },
    });

    if (createdNotices.length > 0) {
      this.realtime.emitNoticeSynced({
        created: createdNotices.length,
        notices: createdNotices.map((n) => ({ id: n.id, title: n.title, sourceUrl: n.sourceUrl })),
      });
    }

    this.logger.log(
      `블로그 동기화 완료: ${createdNotices.length}건 생성, ${skipped}건 스킵, ${failures.length}건 실패`,
    );
    return {
      runId,
      status: 'ok',
      fetched: items.length,
      created: createdNotices.length,
      skipped,
      deferred: eligible.length - batch.length,
      failures,
      createdTitles: createdNotices.map((n) => n.title),
    };
  }

  private async importOne(item: BlogRssItem): Promise<Notice> {
    const parsed = await this.fetcher.fetchPost(this.settings.blogId, item.logNo);
    const transformed = await this.transformer.transform(parsed, item);
    const { html: mirroredHtml, firstImageUrl } = await this.mirror.mirrorImages(
      transformed.bodyHtml,
    );
    const normalized = normalizeNoticeHtml(mirroredHtml);
    const { html: capped } = truncateHtmlBlocks(normalized, BODY_MAX_CHARS);
    const body = `${capped}\n<p><a href="${item.url}" target="_blank" rel="noopener noreferrer">네이버 블로그 원문 보기</a></p>`;

    // Always visible=false: an admin reviews and publishes by hand — never auto-publish.
    return this.notices.create({
      title: item.title,
      body,
      date: toKstDisplayDate(item.publishedAt),
      image: firstImageUrl,
      visible: false,
      pinned: false,
      sourceUrl: item.url,
      sourceId: item.logNo,
      syncedAt: new Date(),
    });
  }

  /**
   * First-import guard: without a cutoff the first run would drag in every past
   * post. BLOG_SYNC_SINCE wins; otherwise the first run's own start time
   * (persisted as the oldest BlogSyncRun row) becomes the permanent cutoff.
   */
  private async resolveCutoff(): Promise<Date> {
    const { since } = this.settings;
    if (since) return new Date(since);
    const first = await this.prisma.blogSyncRun.findFirst({ orderBy: { startedAt: 'asc' } });
    return first?.startedAt ?? new Date();
  }

  /** Keep the newest RUNS_TO_KEEP rows plus the oldest one (it anchors the cutoff). */
  private async pruneRuns(): Promise<void> {
    const keep = await this.prisma.blogSyncRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: RUNS_TO_KEEP,
      select: { id: true },
    });
    const oldest = await this.prisma.blogSyncRun.findFirst({
      orderBy: { startedAt: 'asc' },
      select: { id: true },
    });
    const ids = new Set(keep.map((r) => r.id));
    if (oldest) ids.add(oldest.id);
    await this.prisma.blogSyncRun.deleteMany({ where: { id: { notIn: [...ids] } } });
  }

  async status(): Promise<{
    enabled: boolean;
    blogId: string;
    cron: string;
    categories: string[];
    maxPerRun: number;
    since: string | null;
    running: boolean;
    lastRun: BlogSyncRun | null;
    recentRuns: BlogSyncRun[];
  }> {
    const { enabled, blogId, cron, categories, maxPerRun, since } = this.settings;
    const recentRuns = await this.prisma.blogSyncRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 10,
    });
    return {
      enabled,
      blogId,
      cron,
      categories,
      maxPerRun,
      since: since || null,
      running: this.running,
      lastRun: recentRuns[0] ?? null,
      recentRuns,
    };
  }
}

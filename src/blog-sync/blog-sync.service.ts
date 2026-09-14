import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlogSyncRun } from '@prisma/client';
import { AppException } from '../common/exceptions/app.exception';
import type { AppConfig } from '../config/configuration';
import { ArticlesService, type ArticleView } from '../articles/articles.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { slugify } from '../common/slug.util';
import { POST_TRANSFORMER, type BlogRssItem, type PostTransformer } from './blog-sync.types';
import { truncateHtmlBlocks } from './blog-sync.util';
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
    private readonly articles: ArticlesService,
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
    // including soft-deleted articles, so an admin's delete is never undone.
    const fresh = items.filter((i) => i.publishedAt >= cutoff);
    const allowed =
      categories.length > 0 ? fresh.filter((i) => categories.includes(i.category)) : fresh;
    const existing = await this.prisma.article.findMany({
      where: { sourceUrl: { in: allowed.map((i) => i.url) } },
      select: { sourceUrl: true },
    });
    const known = new Set(existing.map((a) => a.sourceUrl));
    const eligible = allowed
      .filter((i) => !known.has(i.url))
      .sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());

    const batch = eligible.slice(0, maxPerRun);
    const skipped = items.length - eligible.length;
    const failures: string[] = [];
    const created: ArticleView[] = [];

    for (const item of batch) {
      try {
        created.push(await this.importOne(item));
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
        created: created.length,
        skipped,
        error: failures.length > 0 ? failures.join('\n').slice(0, 2000) : null,
      },
    });

    if (created.length > 0) {
      this.realtime.emitBlogSynced({
        created: created.length,
        articles: created.map((a) => ({
          id: a.id,
          title: a.title,
          slug: a.slug,
          sourceUrl: a.sourceUrl,
        })),
      });
    }

    this.logger.log(
      `블로그 동기화 완료: ${created.length}건 생성, ${skipped}건 스킵, ${failures.length}건 실패`,
    );
    return {
      runId,
      status: 'ok',
      fetched: items.length,
      created: created.length,
      skipped,
      deferred: eligible.length - batch.length,
      failures,
      createdTitles: created.map((a) => a.title),
    };
  }

  private async importOne(item: BlogRssItem): Promise<ArticleView> {
    const parsed = await this.fetcher.fetchPost(this.settings.blogId, item.logNo);
    const transformed = await this.transformer.transform(parsed, item);
    const { html: mirroredHtml, firstImageUrl } = await this.mirror.mirrorImages(
      transformed.bodyHtml,
    );
    const normalized = normalizeNoticeHtml(mirroredHtml);
    const { html: capped } = truncateHtmlBlocks(normalized, BODY_MAX_CHARS);
    const content = `${capped}\n<p><a href="${item.url}" target="_blank" rel="noopener noreferrer">네이버 블로그 원문 보기</a></p>`;

    // Always draft: an admin reviews (and may edit) then publishes — never auto-publish.
    // publishedAt is pre-set to the blog date so the public list keeps the real
    // chronology after publishing (ArticlesService keeps an existing publishedAt).
    return this.articles.create({
      title: item.title,
      slug: await this.freeSlug(item),
      content,
      thumbnail: firstImageUrl,
      categoryId: await this.resolveCategoryId(item.category),
      status: 'draft',
      visible: true,
      publishedAt: item.publishedAt,
      sourceUrl: item.url,
      sourceId: item.logNo,
      syncedAt: new Date(),
    });
  }

  /** Slug from the title; on collision, the logNo makes it unique. */
  private async freeSlug(item: BlogRssItem): Promise<string> {
    const base = slugify(item.title) || `blog-${item.logNo}`;
    const taken = await this.prisma.article.findFirst({ where: { slug: base } });
    return taken ? `${base}-${item.logNo}` : base;
  }

  /** Map the Naver category to an ArticleCategory by name, creating it on first sight. */
  private async resolveCategoryId(name: string): Promise<string | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const found = await this.prisma.articleCategory.findFirst({
      where: { name: trimmed, deletedAt: null },
    });
    if (found) return found.id;
    const slugBase = slugify(trimmed) || 'blog';
    const slugTaken = await this.prisma.articleCategory.findFirst({ where: { slug: slugBase } });
    const created = await this.prisma.articleCategory.create({
      data: { name: trimmed, slug: slugTaken ? `${slugBase}-${Date.now()}` : slugBase },
    });
    return created.id;
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

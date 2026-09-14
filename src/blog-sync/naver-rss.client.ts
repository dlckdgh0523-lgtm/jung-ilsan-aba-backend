import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { XMLParser } from 'fast-xml-parser';
import { AppException } from '../common/exceptions/app.exception';
import type { AppConfig } from '../config/configuration';
import { BLOG_FETCH, type BlogRssItem, type FetchLike } from './blog-sync.types';
import { canonicalPostUrl } from './blog-sync.util';

/** Naver serves RSS to plain clients, but send a browser UA to match the fetcher. */
export const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

interface RawRssItem {
  title?: unknown;
  link?: unknown;
  guid?: unknown;
  category?: unknown;
  pubDate?: unknown;
}

/**
 * Parse Naver blog RSS into sync items. Pure — exported for fixture tests.
 * Quirks handled: single `<item>` parses as an object (not array); `<category>`
 * may repeat; the `<link>` carries `?fromRss=true` tracking (we canonicalise
 * from logNo instead); `<description>` is a ~500-char summary and is ignored —
 * the full body always comes from the mobile page.
 */
export function parseRssXml(xml: string, blogId: string): BlogRssItem[] {
  const doc: unknown = new XMLParser({ ignoreAttributes: true }).parse(xml);
  const channel = (doc as { rss?: { channel?: { item?: RawRssItem | RawRssItem[] } } })?.rss
    ?.channel;
  if (!channel) return [];
  const rawItems = Array.isArray(channel.item) ? channel.item : channel.item ? [channel.item] : [];

  const items: BlogRssItem[] = [];
  for (const raw of rawItems) {
    const link = String(raw.guid ?? raw.link ?? '');
    const logNo = /(\d{6,})/.exec(new URL(link, 'https://blog.naver.com').pathname)?.[1];
    if (!logNo) continue;
    const publishedAt = new Date(String(raw.pubDate ?? ''));
    if (Number.isNaN(publishedAt.getTime())) continue;
    const category = Array.isArray(raw.category)
      ? String(raw.category[0] ?? '')
      : String(raw.category ?? '');
    items.push({
      logNo,
      url: canonicalPostUrl(blogId, logNo),
      title: String(raw.title ?? '').trim(),
      category: category.trim(),
      publishedAt,
    });
  }
  return items;
}

@Injectable()
export class NaverRssClient {
  private readonly timeoutMs: number;

  constructor(
    @Inject(BLOG_FETCH) private readonly fetchFn: FetchLike,
    config: ConfigService<AppConfig, true>,
  ) {
    this.timeoutMs = config.get('blogSync', { infer: true }).fetchTimeoutMs;
  }

  /** Latest posts (Naver returns up to ~50), newest first as served. */
  async fetchItems(blogId: string): Promise<BlogRssItem[]> {
    const url = `https://rss.blog.naver.com/${encodeURIComponent(blogId)}.xml`;
    let res: Response;
    try {
      res = await this.fetchFn(url, {
        headers: { 'User-Agent': BROWSER_UA },
        signal: AbortSignal.timeout(this.timeoutMs),
        redirect: 'follow',
      });
    } catch (e) {
      throw AppException.badRequest(
        `블로그 RSS 요청 실패: ${(e as Error).message}`,
        'BLOG_RSS_FETCH_FAILED',
      );
    }
    const body = res.ok ? await res.text() : '';
    if (!res.ok || !body.includes('<rss')) {
      // 404/empty usually means the blog turned RSS off (비공개) or the id is wrong.
      throw AppException.badRequest(
        `블로그 RSS 응답이 올바르지 않습니다 (HTTP ${res.status}). ` +
          'RSS가 비공개이거나 NAVER_BLOG_ID가 잘못되었을 수 있습니다.',
        'BLOG_RSS_INVALID',
      );
    }
    return parseRssXml(body, blogId);
  }
}

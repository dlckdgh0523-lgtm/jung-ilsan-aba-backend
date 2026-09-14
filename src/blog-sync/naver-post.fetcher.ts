import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { AppException } from '../common/exceptions/app.exception';
import type { AppConfig } from '../config/configuration';
import { BLOG_FETCH, type FetchLike, type ParsedPost } from './blog-sync.types';
import { mobilePostUrl } from './blog-sync.util';
import { BROWSER_UA } from './naver-rss.client';

/** SmartEditor ONE module classes we deliberately drop (replaced by the source link). */
const DROPPED_MODULES = [
  'se-video',
  'se-sticker',
  'se-map',
  'se-placesMap',
  'se-file',
  'se-horizontalLine',
  'se-oembed',
  'se-material',
  'se-schedule',
  'se-code',
  'se-table',
  'se-documentTitle',
];

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Parse a Naver mobile PostView page into block-level HTML. Pure — exported for
 * fixture tests. SmartEditor ONE first; legacy editors (`#postViewArea`, then
 * `#viewTypeSelector`) as fallback; neither present ⇒ error (parser is broken
 * or Naver changed markup — that's an alert, not a silent empty notice).
 */
export function parseNaverPostHtml(html: string): ParsedPost {
  const $ = cheerio.load(html);
  const title = ($('meta[property="og:title"]').attr('content') ?? '').trim();

  const seContainer = $('.se-main-container').first();
  if (seContainer.length > 0) return parseSmartEditorOne($, seContainer, title);

  // Legacy editors: no module structure — take the raw HTML and let the
  // sanitiser reduce it (images are filtered by host in the mirror step).
  for (const selector of ['#postViewArea', '#viewTypeSelector']) {
    const legacy = $(selector).first();
    if (legacy.length > 0) {
      const bodyHtml = legacy.html() ?? '';
      const imageUrls: string[] = [];
      legacy.find('img').each((_i, el) => {
        const src = $(el).attr('data-lazy-src') ?? $(el).attr('src');
        if (src) imageUrls.push(src);
      });
      return { title, bodyHtml, imageUrls, dropped: [] };
    }
  }

  throw AppException.unprocessable(
    '본문 컨테이너를 찾지 못했습니다 (.se-main-container / #postViewArea / #viewTypeSelector). ' +
      '네이버 마크업이 바뀌었거나 파서가 깨졌을 수 있습니다.',
    'BLOG_POST_PARSE_FAILED',
  );
}

function parseSmartEditorOne(
  $: cheerio.CheerioAPI,
  container: cheerio.Cheerio<AnyNode>,
  title: string,
): ParsedPost {
  const blocks: string[] = [];
  const imageUrls: string[] = [];
  const dropped: string[] = [];

  let components = container.children('.se-component');
  if (components.length === 0) components = container.find('.se-component');

  components.each((_i, el) => {
    const comp = $(el);

    if (comp.hasClass('se-text')) {
      comp.find('p.se-text-paragraph').each((_j, p) => {
        // Inner spans carry font classes/styles; the sanitiser strips them to text.
        blocks.push(`<p>${$(p).html() ?? ''}</p>`);
      });
      return;
    }

    if (comp.hasClass('se-quotation')) {
      const paragraphs: string[] = [];
      comp.find('p.se-text-paragraph').each((_j, p) => {
        paragraphs.push(`<p>${$(p).html() ?? ''}</p>`);
      });
      if (paragraphs.length > 0) blocks.push(`<blockquote>${paragraphs.join('')}</blockquote>`);
      return;
    }

    if (
      comp.hasClass('se-image') ||
      comp.hasClass('se-imageStrip') ||
      comp.hasClass('se-imageGroup')
    ) {
      comp.find('img').each((_j, img) => {
        // data-lazy-src holds the real URL; src is a tiny blurred placeholder.
        const src = $(img).attr('data-lazy-src') ?? $(img).attr('src');
        if (!src) return;
        imageUrls.push(src);
        const caption = comp.find('.se-caption').first().text().trim();
        blocks.push(`<p><img src="${esc(src)}" alt="${esc(caption)}" /></p>`);
      });
      return;
    }

    if (comp.hasClass('se-oglink')) {
      const a = comp.find('a').first();
      const href = a.attr('href');
      if (!href) return;
      const label = comp.find('.se-oglink-title').first().text().trim() || href;
      blocks.push(`<p><a href="${esc(href)}">${esc(label)}</a></p>`);
      return;
    }

    const type = DROPPED_MODULES.find((c) => comp.hasClass(c));
    if (type) dropped.push(type);
  });

  return { title, bodyHtml: blocks.join('\n'), imageUrls, dropped };
}

@Injectable()
export class NaverPostFetcher {
  private readonly timeoutMs: number;

  constructor(
    @Inject(BLOG_FETCH) private readonly fetchFn: FetchLike,
    config: ConfigService<AppConfig, true>,
  ) {
    this.timeoutMs = config.get('blogSync', { infer: true }).fetchTimeoutMs;
  }

  async fetchPost(blogId: string, logNo: string): Promise<ParsedPost> {
    const url = mobilePostUrl(blogId, logNo);
    let res: Response;
    try {
      // Browser UA is required — the mobile page serves bots a stripped shell.
      res = await this.fetchFn(url, {
        headers: { 'User-Agent': BROWSER_UA, Referer: 'https://m.blog.naver.com/' },
        signal: AbortSignal.timeout(this.timeoutMs),
        redirect: 'follow',
      });
    } catch (e) {
      throw AppException.badRequest(
        `블로그 본문 요청 실패 (logNo=${logNo}): ${(e as Error).message}`,
        'BLOG_POST_FETCH_FAILED',
      );
    }
    if (!res.ok) {
      throw AppException.badRequest(
        `블로그 본문 응답 오류 (logNo=${logNo}, HTTP ${res.status})`,
        'BLOG_POST_FETCH_FAILED',
      );
    }
    return parseNaverPostHtml(await res.text());
  }
}

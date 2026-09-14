import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cheerio from 'cheerio';
import type { AppConfig } from '../config/configuration';
import { UploadsService } from '../uploads/uploads.service';
import { BLOG_FETCH, type FetchLike } from './blog-sync.types';
import { BROWSER_UA } from './naver-rss.client';

/** Only Naver blog CDNs are ever downloaded — anything else is stripped. */
const ALLOWED_HOSTS = new Set([
  'mblogthumb-phinf.pstatic.net',
  'postfiles.pstatic.net',
  'blogfiles.pstatic.net',
]);

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/** Per-post cap — beyond this, images are dropped (the source link covers the rest). */
const MAX_IMAGES_PER_POST = 30;

/**
 * Download-candidate URLs in preference order (measured 2026-09-12):
 * the mobile page serves `mblogthumb-phinf…?type=w800`; stripping only the
 * query 404s. The original lives at `blogfiles.pstatic.net{path}` (no query);
 * if that fails, fall back to the source host with `?type=w966`.
 * Non-allowlisted hosts return [] — caller strips the <img>.
 */
export function naverImageCandidates(raw: string): string[] {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return [];
  }
  if (!ALLOWED_HOSTS.has(url.hostname)) return [];
  const original = `https://blogfiles.pstatic.net${url.pathname}`;
  const resized = `https://${url.hostname}${url.pathname}?type=w966`;
  return original === resized ? [original] : [original, resized];
}

export interface MirrorResult {
  html: string;
  /** Mirrored URL of the first successful image — used as the notice thumbnail. */
  firstImageUrl: string | null;
  mirrored: number;
  failed: number;
}

@Injectable()
export class ImageMirrorService {
  private readonly logger = new Logger(ImageMirrorService.name);
  private readonly timeoutMs: number;

  constructor(
    @Inject(BLOG_FETCH) private readonly fetchFn: FetchLike,
    private readonly uploads: UploadsService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.timeoutMs = config.get('blogSync', { infer: true }).fetchTimeoutMs;
  }

  /**
   * Rewrite every <img> in `html` to a locally mirrored copy. A single failed
   * image only removes that <img>; the post itself still imports. Sequential
   * on purpose — a sync run is background work, don't hammer Naver's CDN.
   */
  async mirrorImages(html: string): Promise<MirrorResult> {
    const $ = cheerio.load(html, null, false);
    const images = $('img').toArray();
    let firstImageUrl: string | null = null;
    let mirrored = 0;
    let failed = 0;

    for (const [index, el] of images.entries()) {
      const img = $(el);
      const src = img.attr('src') ?? '';
      const stored = index < MAX_IMAGES_PER_POST ? await this.mirrorOne(src) : null;
      if (stored) {
        img.attr('src', stored);
        firstImageUrl ??= stored;
        mirrored += 1;
      } else {
        // Strip the surrounding <p> too when the image was its only content.
        const parent = img.parent();
        img.remove();
        if (parent.is('p') && parent.text().trim() === '' && parent.children().length === 0) {
          parent.remove();
        }
        failed += 1;
      }
    }
    return { html: $.html(), firstImageUrl, mirrored, failed };
  }

  private async mirrorOne(src: string): Promise<string | null> {
    for (const candidate of naverImageCandidates(src)) {
      try {
        const buffer = await this.download(candidate);
        if (!buffer) continue;
        // saveImage re-encodes + downscales to the configured max width,
        // so fetching the original (not the w800 thumb) is the right input.
        const saved = await this.uploads.saveImage({
          buffer,
          originalname: candidate.split('/').pop() ?? 'blog-image',
          mimetype: 'application/octet-stream',
          size: buffer.length,
        } as Express.Multer.File);
        return saved.url;
      } catch (e) {
        this.logger.warn(`이미지 미러 실패 (${candidate}): ${(e as Error).message}`);
      }
    }
    return null;
  }

  private async download(url: string): Promise<Buffer | null> {
    const res = await this.fetchFn(url, {
      // Referer not strictly required today, but keep it — cheap insurance.
      headers: { 'User-Agent': BROWSER_UA, Referer: 'https://blog.naver.com/' },
      signal: AbortSignal.timeout(this.timeoutMs),
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > MAX_IMAGE_BYTES) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) return null;
    return buffer;
  }
}

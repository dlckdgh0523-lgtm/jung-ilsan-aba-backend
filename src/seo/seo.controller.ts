import { Controller, Get, Header, NotFoundException, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { SeoHealthService, type SeoHealthReport } from './seo-health.service';
import { SeoService } from './seo.service';

function pageNum(v?: string): number {
  const n = parseInt(v || '1', 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * Crawler-facing pages. Vercel rewrites the public paths here:
 *   /sitemap.xml  → /v1/sitemap.xml
 *   /blog         → /v1/seo/blog
 *   /blog/:slug   → /v1/seo/blog/:slug
 *   /tags/:slug   → /v1/seo/tags/:slug
 */
@Controller()
export class SeoController {
  constructor(
    private readonly service: SeoService,
    private readonly health: SeoHealthService,
  ) {}

  /** 관리자용 콘텐츠 품질 점검 (검색엔진 점수가 아니라 내부 체크리스트). */
  @Get('seo/health')
  @AdminOnly()
  healthReport(): Promise<SeoHealthReport> {
    return this.health.report();
  }

  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  sitemap(): Promise<string> {
    return this.service.sitemapXml();
  }

  /**
   * Served at the API ORIGIN root (excluded from the global prefix): the API
   * host must never be indexed — the same content lives on the front domain
   * via Vercel rewrites, and that domain owns the canonical URLs.
   */
  @Get('robots.txt')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=86400')
  robots(): string {
    return 'User-agent: *\nDisallow: /\n';
  }

  @Get('seo/blog')
  async blog(@Query('page') page: string | undefined, @Res() res: Response): Promise<void> {
    const html = await this.service.blogIndexHtml(pageNum(page));
    res.type('html').send(html);
  }

  @Get('seo/blog/:slug')
  async article(@Param('slug') slug: string, @Res() res: Response): Promise<void> {
    const html = await this.service.articleHtml(decodeURIComponent(slug));
    if (!html) throw new NotFoundException('게시글을 찾을 수 없습니다');
    res.type('html').send(html);
  }

  @Get('seo/tags/:slug')
  async tag(
    @Param('slug') slug: string,
    @Query('page') page: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const html = await this.service.tagHtml(decodeURIComponent(slug), pageNum(page));
    if (!html) throw new NotFoundException('태그를 찾을 수 없습니다');
    res.type('html').send(html);
  }
}

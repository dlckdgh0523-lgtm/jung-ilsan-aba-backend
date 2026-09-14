import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { AppException } from '../common/exceptions/app.exception';
import { BlogSyncService, SyncSummary } from './blog-sync.service';
import { parseNaverPostUrl } from './blog-sync.util';
import { GeoReviewService, type GeoAnalysis } from './geo-review.service';
import { normalizeNoticeHtml } from './html-normalizer';
import { NaverPostFetcher } from './naver-post.fetcher';
import { PrismaService } from '../prisma/prisma.service';
import { PreviewPostDto } from './dto/preview-post.dto';

@Controller('blog-sync')
export class BlogSyncController {
  constructor(
    private readonly service: BlogSyncService,
    private readonly fetcher: NaverPostFetcher,
    private readonly geoReview: GeoReviewService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 게시글의 GEO 검수 결과 조회(관리자 승인 화면용). 저장된 결과가 없고
   * ?run=1이면 즉석 분석 후 저장해서 반환 (GEO_REVIEW_ENABLED + API 키 필요).
   */
  @Get('geo-analysis/:articleId')
  @AdminOnly()
  async geoAnalysis(
    @Param('articleId') articleId: string,
  ): Promise<{ active: boolean; analysis: GeoAnalysis | null }> {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
      select: { geoAnalysis: true },
    });
    if (!article) throw AppException.notFound('게시글을 찾을 수 없습니다');
    return {
      active: this.geoReview.active,
      analysis: (article.geoAnalysis as GeoAnalysis | null) ?? null,
    };
  }

  /** 저장된 결과가 없거나 다시 돌리고 싶을 때 — 즉석 분석 후 저장. */
  @Post('geo-analysis/:articleId')
  @AdminOnly()
  @HttpCode(200)
  async runGeoAnalysis(
    @Param('articleId') articleId: string,
  ): Promise<{ active: boolean; analysis: GeoAnalysis | null }> {
    if (!this.geoReview.active) {
      throw AppException.badRequest(
        'GEO 검수가 꺼져 있습니다. GEO_REVIEW_ENABLED=true와 ANTHROPIC_API_KEY(또는 LLM_API_KEY)를 설정하세요.',
        'GEO_REVIEW_DISABLED',
      );
    }
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
      select: { id: true, title: true, content: true },
    });
    if (!article) throw AppException.notFound('게시글을 찾을 수 없습니다');
    await this.geoReview.analyzeAndStore(article.id, article.title, article.content || '');
    const saved = await this.prisma.article.findUnique({
      where: { id: articleId },
      select: { geoAnalysis: true },
    });
    return { active: true, analysis: (saved?.geoAnalysis as GeoAnalysis | null) ?? null };
  }

  /** Run a sync now (admin button). 409 if one is already in flight. */
  @Post('run')
  @AdminOnly()
  @HttpCode(200)
  run(): Promise<SyncSummary> {
    return this.service.run('manual');
  }

  @Get('status')
  @AdminOnly()
  status(): ReturnType<BlogSyncService['status']> {
    return this.service.status();
  }

  /**
   * Re-send the review alimtalk for one article (rotates the link token, which
   * invalidates the previously sent one). Also the way to notify about drafts
   * created before alimtalk was connected. 409 once a decision exists.
   */
  @Post('notify/:articleId')
  @AdminOnly()
  @HttpCode(200)
  async notify(@Param('articleId') articleId: string): Promise<{ result: string }> {
    return { result: await this.service.notifyReview(articleId) };
  }

  /**
   * Parse a post without saving anything — for checking the parser (and, right
   * after deploy, that Naver is reachable from the server's IP at all).
   * Images are listed but NOT mirrored; body shows original Naver URLs.
   */
  @Post('preview')
  @AdminOnly()
  @HttpCode(200)
  async preview(@Body() dto: PreviewPostDto): Promise<{
    title: string;
    body: string;
    images: string[];
    dropped: string[];
  }> {
    const ref = parseNaverPostUrl(dto.url);
    if (!ref) {
      throw AppException.badRequest(
        '네이버 블로그 글 URL이 아닙니다. (blog.naver.com / m.blog.naver.com)',
        'BLOG_PREVIEW_INVALID_URL',
      );
    }
    const parsed = await this.fetcher.fetchPost(ref.blogId, ref.logNo);
    return {
      title: parsed.title,
      body: normalizeNoticeHtml(parsed.bodyHtml),
      images: parsed.imageUrls,
      dropped: parsed.dropped,
    };
  }
}

import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { AppException } from '../common/exceptions/app.exception';
import { BlogSyncService, SyncSummary } from './blog-sync.service';
import { parseNaverPostUrl } from './blog-sync.util';
import { normalizeNoticeHtml } from './html-normalizer';
import { NaverPostFetcher } from './naver-post.fetcher';
import { PreviewPostDto } from './dto/preview-post.dto';

@Controller('blog-sync')
export class BlogSyncController {
  constructor(
    private readonly service: BlogSyncService,
    private readonly fetcher: NaverPostFetcher,
  ) {}

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

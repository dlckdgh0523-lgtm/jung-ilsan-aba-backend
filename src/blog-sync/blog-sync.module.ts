import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AlimtalkModule } from '../alimtalk/alimtalk.module';
import { ArticlesModule } from '../articles/articles.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { UploadsModule } from '../uploads/uploads.module';
import { BlogSyncController } from './blog-sync.controller';
import { BlogSyncScheduler } from './blog-sync.scheduler';
import { BlogSyncService } from './blog-sync.service';
import { BLOG_FETCH, POST_TRANSFORMER } from './blog-sync.types';
import { ImageMirrorService } from './image-mirror.service';
import { NaverPostFetcher } from './naver-post.fetcher';
import { NaverRssClient } from './naver-rss.client';
import { ReviewController } from './review/review.controller';
import { ReviewService } from './review/review.service';
import { AnthropicLlmClient } from './transform/anthropic-llm.client';
import { LLM_CLIENT } from './transform/llm-client.interface';
import { LlmPostTransformer } from './transform/llm-post-transformer';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ArticlesModule,
    UploadsModule,
    RealtimeModule,
    AlimtalkModule,
  ],
  controllers: [BlogSyncController, ReviewController],
  providers: [
    BlogSyncService,
    BlogSyncScheduler,
    NaverRssClient,
    NaverPostFetcher,
    ImageMirrorService,
    ReviewService,
    { provide: BLOG_FETCH, useValue: fetch },
    // Title/summary cleanup: LLM when LLM_ENABLED=true, passthrough otherwise
    // (LlmPostTransformer no-ops when disabled). The body is never LLM-touched.
    { provide: LLM_CLIENT, useClass: AnthropicLlmClient },
    { provide: POST_TRANSFORMER, useClass: LlmPostTransformer },
  ],
})
export class BlogSyncModule {}

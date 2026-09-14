import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NoticesModule } from '../notices/notices.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { UploadsModule } from '../uploads/uploads.module';
import { BlogSyncController } from './blog-sync.controller';
import { BlogSyncScheduler } from './blog-sync.scheduler';
import { BlogSyncService } from './blog-sync.service';
import { BLOG_FETCH, POST_TRANSFORMER } from './blog-sync.types';
import { ImageMirrorService } from './image-mirror.service';
import { NaverPostFetcher } from './naver-post.fetcher';
import { NaverRssClient } from './naver-rss.client';
import { PassthroughPostTransformer } from './post-transformer';

@Module({
  imports: [ScheduleModule.forRoot(), NoticesModule, UploadsModule, RealtimeModule],
  controllers: [BlogSyncController],
  providers: [
    BlogSyncService,
    BlogSyncScheduler,
    NaverRssClient,
    NaverPostFetcher,
    ImageMirrorService,
    { provide: BLOG_FETCH, useValue: fetch },
    { provide: POST_TRANSFORMER, useClass: PassthroughPostTransformer },
  ],
})
export class BlogSyncModule {}

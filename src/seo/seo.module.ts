import { Module } from '@nestjs/common';
import { SeoController } from './seo.controller';
import { SeoService } from './seo.service';
import { ArticlesModule } from '../articles/articles.module';
import { TagsModule } from '../tags/tags.module';

@Module({
  imports: [ArticlesModule, TagsModule],
  controllers: [SeoController],
  providers: [SeoService],
})
export class SeoModule {}

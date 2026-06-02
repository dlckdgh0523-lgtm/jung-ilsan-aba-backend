import { Module } from '@nestjs/common';
import { SiteController } from './site.controller';
import { NavController } from './nav.controller';
import { SiteService } from './site.service';
import { NavService } from './nav.service';

@Module({
  controllers: [SiteController, NavController],
  providers: [SiteService, NavService],
})
export class SiteModule {}

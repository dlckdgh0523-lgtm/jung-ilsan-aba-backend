import { Module } from '@nestjs/common';
import { LoggerOpsAlert, OPS_ALERT } from '../common/services/ops-alert';
import { BLOG_FETCH } from '../blog-sync/blog-sync.types';
import { AlimtalkController } from './alimtalk.controller';
import { ALIMTALK_PROVIDER } from './alimtalk-provider.interface';
import { AlimtalkService } from './alimtalk.service';
import { SolapiProvider } from './providers/solapi.provider';

@Module({
  controllers: [AlimtalkController],
  providers: [
    AlimtalkService,
    { provide: BLOG_FETCH, useValue: fetch },
    // One dealer implementation today; other dealers = another adapter class here.
    { provide: ALIMTALK_PROVIDER, useClass: SolapiProvider },
    { provide: OPS_ALERT, useClass: LoggerOpsAlert },
  ],
  exports: [AlimtalkService, OPS_ALERT],
})
export class AlimtalkModule {}

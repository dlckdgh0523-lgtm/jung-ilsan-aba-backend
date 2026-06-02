import { Module } from '@nestjs/common';
import { StatsModule } from '../stats/stats.module';
import { RealtimeController } from './realtime.controller';
import { RealtimeService } from './realtime.service';
import { SseAuthGuard } from './sse-auth.guard';

@Module({
  imports: [StatsModule],
  controllers: [RealtimeController],
  providers: [RealtimeService, SseAuthGuard],
  exports: [RealtimeService],
})
export class RealtimeModule {}

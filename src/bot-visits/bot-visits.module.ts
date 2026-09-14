import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { BotVisitMiddleware } from './bot-visit.middleware';
import { BotVisitsController } from './bot-visits.controller';
import { BotVisitsService } from './bot-visits.service';

@Module({
  controllers: [BotVisitsController],
  providers: [BotVisitsService, BotVisitMiddleware],
  exports: [BotVisitsService],
})
export class BotVisitsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(BotVisitMiddleware).forRoutes('*');
  }
}

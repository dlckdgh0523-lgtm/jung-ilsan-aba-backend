import { Controller, Get, Query } from '@nestjs/common';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { BotVisitsService, type BotVisitSummary } from './bot-visits.service';

@Controller('admin/bot-visits')
export class BotVisitsController {
  constructor(private readonly service: BotVisitsService) {}

  @Get()
  @AdminOnly()
  summary(@Query('days') days?: string): Promise<BotVisitSummary> {
    const n = parseInt(days || '30', 10);
    return this.service.summary(Number.isFinite(n) && n > 0 && n <= 365 ? n : 30);
  }
}

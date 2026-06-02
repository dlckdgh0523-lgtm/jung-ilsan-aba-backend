import { Body, Controller, Get, HttpCode, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { StatsService, type StatsRangePoint, type StatsSummary } from './stats.service';
import { CreateHitDto } from './dto/create-hit.dto';
import { StatsRangeDto } from './dto/stats-range.dto';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';

@Controller('stats')
export class StatsController {
  constructor(private readonly service: StatsService) {}

  /** Public fire-and-forget page-view ping. */
  @Post('hit')
  @HttpCode(202)
  hit(@Body() dto: CreateHitDto, @Req() req: Request): Promise<{ ok: true }> {
    return this.service.recordHit(dto, req.ip);
  }

  @Get('summary')
  @AdminOnly()
  summary(): Promise<StatsSummary> {
    return this.service.summary();
  }

  @Get('range')
  @AdminOnly()
  range(@Query() query: StatsRangeDto): Promise<StatsRangePoint[]> {
    return this.service.range(query.days);
  }
}

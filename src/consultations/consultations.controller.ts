import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { ConsultationsService, type ConsultationView } from './consultations.service';
import { CreateConsultationDto } from './dto/create-consultation.dto';
import { UpdateConsultationDto } from './dto/update-consultation.dto';
import { ListConsultationsDto } from './dto/list-consultations.dto';
import type { ListResult } from '../common/pagination/paginate.util';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';

@Controller('consultations')
export class ConsultationsController {
  constructor(private readonly service: ConsultationsService) {}

  /** Public intake — limited to 5 requests/min per IP (anti-spam). */
  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  create(
    @Body() dto: CreateConsultationDto,
    @Req() req: Request,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<ConsultationView> {
    return this.service.create(dto, req.ip, idempotencyKey);
  }

  @Get()
  @AdminOnly()
  list(@Query() query: ListConsultationsDto): Promise<ListResult<ConsultationView>> {
    return this.service.list(query);
  }

  @Get(':id')
  @AdminOnly()
  findOne(@Param('id') id: string): Promise<ConsultationView> {
    return this.service.findOne(id, { withTrashed: true });
  }

  @Put(':id')
  @AdminOnly()
  update(@Param('id') id: string, @Body() dto: UpdateConsultationDto): Promise<ConsultationView> {
    return this.service.update(id, dto);
  }

  @Patch(':id')
  @AdminOnly()
  patch(@Param('id') id: string, @Body() dto: UpdateConsultationDto): Promise<ConsultationView> {
    return this.service.update(id, dto);
  }

  @Patch(':id/read')
  @AdminOnly()
  markRead(@Param('id') id: string): Promise<ConsultationView> {
    return this.service.markRead(id, true);
  }

  @Delete(':id')
  @AdminOnly()
  @HttpCode(204)
  async remove(@Param('id') id: string, @Query('hard') hard?: string): Promise<void> {
    if (hard === 'true') await this.service.hardDelete(id);
    else await this.service.softDelete(id);
  }

  @Post(':id/restore')
  @AdminOnly()
  restore(@Param('id') id: string): Promise<ConsultationView> {
    return this.service.restore(id);
  }
}

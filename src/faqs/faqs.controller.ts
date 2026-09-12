import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FaqItem } from '@prisma/client';
import { FaqsService } from './faqs.service';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ReorderDto } from '../common/dto/reorder.dto';
import { VisibilityDto } from '../common/dto/visibility.dto';
import { clampListQuery } from '../common/pagination/clamp-list-query';
import type { ListResult } from '../common/pagination/paginate.util';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';

@Controller('faqs')
export class FaqsController {
  constructor(private readonly service: FaqsService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  list(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user?: AuthUser,
  ): Promise<ListResult<FaqItem>> {
    return this.service.list(clampListQuery(query, Boolean(user)));
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  findOne(@Param('id') id: string, @CurrentUser() user?: AuthUser): Promise<FaqItem> {
    return this.service.findOne(id, { withTrashed: Boolean(user) });
  }

  @Post()
  @AdminOnly()
  create(@Body() dto: CreateFaqDto): Promise<FaqItem> {
    return this.service.create({ ...dto });
  }

  @Put('order')
  @AdminOnly()
  @HttpCode(204)
  async reorder(@Body() dto: ReorderDto): Promise<void> {
    await this.service.reorder(dto.ids);
  }

  @Put(':id')
  @AdminOnly()
  update(@Param('id') id: string, @Body() dto: UpdateFaqDto): Promise<FaqItem> {
    return this.service.update(id, { ...dto });
  }

  @Patch(':id')
  @AdminOnly()
  patch(@Param('id') id: string, @Body() dto: UpdateFaqDto): Promise<FaqItem> {
    return this.service.update(id, { ...dto });
  }

  @Patch(':id/visibility')
  @AdminOnly()
  setVisibility(@Param('id') id: string, @Body() dto: VisibilityDto): Promise<FaqItem> {
    return this.service.setVisibility(id, dto.visible);
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
  restore(@Param('id') id: string): Promise<FaqItem> {
    return this.service.restore(id);
  }
}

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
} from '@nestjs/common';
import { PopupsService, type PopupView } from './popups.service';
import { CreatePopupDto } from './dto/create-popup.dto';
import { UpdatePopupDto } from './dto/update-popup.dto';
import { ActiveDto } from './dto/active.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ReorderDto } from '../common/dto/reorder.dto';
import type { ListResult } from '../common/pagination/paginate.util';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';

@Controller('popups')
export class PopupsController {
  constructor(private readonly service: PopupsService) {}

  /** Public: popups the homepage should display right now. */
  @Get('active')
  listActive(): Promise<PopupView[]> {
    return this.service.listActive();
  }

  @Get()
  @AdminOnly()
  list(@Query() query: PaginationQueryDto): Promise<ListResult<PopupView>> {
    return this.service.listView(query);
  }

  @Get(':id')
  @AdminOnly()
  findOne(@Param('id') id: string): Promise<PopupView> {
    return this.service.findOneView(id, { withTrashed: true });
  }

  @Post()
  @AdminOnly()
  create(@Body() dto: CreatePopupDto): Promise<PopupView> {
    return this.service.createPopup({ ...dto });
  }

  @Put('order')
  @AdminOnly()
  @HttpCode(204)
  async reorder(@Body() dto: ReorderDto): Promise<void> {
    await this.service.reorder(dto.ids);
  }

  @Put(':id')
  @AdminOnly()
  update(@Param('id') id: string, @Body() dto: UpdatePopupDto): Promise<PopupView> {
    return this.service.updatePopup(id, { ...dto });
  }

  @Patch(':id')
  @AdminOnly()
  patch(@Param('id') id: string, @Body() dto: UpdatePopupDto): Promise<PopupView> {
    return this.service.updatePopup(id, { ...dto });
  }

  @Patch(':id/active')
  @AdminOnly()
  setActive(@Param('id') id: string, @Body() dto: ActiveDto): Promise<PopupView> {
    return this.service.setActive(id, dto.isActive);
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
  restore(@Param('id') id: string): Promise<PopupView> {
    return this.service.restorePopup(id);
  }
}

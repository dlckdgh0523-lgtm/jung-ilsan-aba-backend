import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Put,
  UseGuards,
} from '@nestjs/common';
import { NavItem } from '@prisma/client';
import { NavService } from './nav.service';
import { UpdateNavDto } from './dto/update-nav.dto';
import { ReorderDto } from '../common/dto/reorder.dto';
import { VisibilityDto } from '../common/dto/visibility.dto';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';

@Controller('nav')
export class NavController {
  constructor(private readonly service: NavService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  list(@CurrentUser() user?: AuthUser): Promise<NavItem[]> {
    return this.service.list(Boolean(user));
  }

  @Put('order')
  @AdminOnly()
  @HttpCode(204)
  async reorder(@Body() dto: ReorderDto): Promise<void> {
    await this.service.reorder(dto.ids);
  }

  @Patch(':id')
  @AdminOnly()
  update(@Param('id') id: string, @Body() dto: UpdateNavDto): Promise<NavItem> {
    return this.service.update(id, dto);
  }

  @Patch(':id/visibility')
  @AdminOnly()
  setVisibility(@Param('id') id: string, @Body() dto: VisibilityDto): Promise<NavItem> {
    return this.service.setVisibility(id, dto.visible);
  }

  @Delete(':id')
  @AdminOnly()
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    await this.service.remove(id);
  }
}

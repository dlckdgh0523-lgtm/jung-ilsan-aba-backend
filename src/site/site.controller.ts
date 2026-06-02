import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { SiteService, SitePayload } from './site.service';
import { UpdateSiteDto } from './dto/update-site.dto';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';

@Controller('site')
export class SiteController {
  constructor(private readonly service: SiteService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  get(@CurrentUser() user?: AuthUser): Promise<SitePayload> {
    return this.service.getSite(Boolean(user));
  }

  @Put()
  @AdminOnly()
  update(@Body() dto: UpdateSiteDto): Promise<SitePayload> {
    return this.service.updateSite(dto);
  }
}

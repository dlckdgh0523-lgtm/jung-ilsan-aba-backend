import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { PrivacyDoc } from '@prisma/client';
import { PrivacyService } from './privacy.service';
import { UpdatePrivacyDto } from './dto/update-privacy.dto';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';

@Controller('privacy')
export class PrivacyController {
  constructor(private readonly service: PrivacyService) {}

  @Get(':kind')
  get(@Param('kind') kind: string): Promise<PrivacyDoc> {
    return this.service.get(kind);
  }

  @Put(':kind')
  @AdminOnly()
  update(@Param('kind') kind: string, @Body() dto: UpdatePrivacyDto): Promise<PrivacyDoc> {
    return this.service.update(kind, dto);
  }
}

import { Body, Controller, Get, Put } from '@nestjs/common';
import { CenterInfo } from '@prisma/client';
import { CenterInfoService } from './center-info.service';
import { UpdateCenterInfoDto } from './dto/update-center-info.dto';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';

@Controller('center-info')
export class CenterInfoController {
  constructor(private readonly service: CenterInfoService) {}

  @Get()
  get(): Promise<CenterInfo> {
    return this.service.get();
  }

  @Put()
  @AdminOnly()
  update(@Body() dto: UpdateCenterInfoDto): Promise<CenterInfo> {
    return this.service.update(dto);
  }
}

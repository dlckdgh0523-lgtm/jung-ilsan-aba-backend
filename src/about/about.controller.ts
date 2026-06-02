import { Body, Controller, Get, Put } from '@nestjs/common';
import { About } from '@prisma/client';
import { AboutService } from './about.service';
import { UpdateAboutDto } from './dto/update-about.dto';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';

@Controller('about')
export class AboutController {
  constructor(private readonly service: AboutService) {}

  @Get()
  get(): Promise<About> {
    return this.service.get();
  }

  @Put()
  @AdminOnly()
  update(@Body() dto: UpdateAboutDto): Promise<About> {
    return this.service.update(dto);
  }
}

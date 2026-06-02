import { Body, Controller, Get, Put } from '@nestjs/common';
import { DirectorService, DirectorView } from './director.service';
import { UpdateDirectorDto } from './dto/update-director.dto';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';

@Controller('director')
export class DirectorController {
  constructor(private readonly service: DirectorService) {}

  @Get()
  get(): Promise<DirectorView> {
    return this.service.get();
  }

  @Put()
  @AdminOnly()
  update(@Body() dto: UpdateDirectorDto): Promise<DirectorView> {
    return this.service.update(dto);
  }
}

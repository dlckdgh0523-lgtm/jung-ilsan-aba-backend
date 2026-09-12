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
import { TagsService, TagView } from './tags.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { ListResult } from '../common/pagination/paginate.util';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';

@Controller('tags')
export class TagsController {
  constructor(private readonly service: TagsService) {}

  @Get()
  list(@Query() query: PaginationQueryDto): Promise<ListResult<TagView>> {
    return this.service.list(query);
  }

  @Get(':idOrSlug')
  findOne(@Param('idOrSlug') idOrSlug: string): Promise<TagView> {
    return this.service.findOne(idOrSlug);
  }

  @Post()
  @AdminOnly()
  create(@Body() dto: CreateTagDto): Promise<TagView> {
    return this.service.create(dto);
  }

  @Put(':id')
  @AdminOnly()
  update(@Param('id') id: string, @Body() dto: UpdateTagDto): Promise<TagView> {
    return this.service.update(id, { ...dto });
  }

  @Patch(':id')
  @AdminOnly()
  patch(@Param('id') id: string, @Body() dto: UpdateTagDto): Promise<TagView> {
    return this.service.update(id, { ...dto });
  }

  @Delete(':id')
  @AdminOnly()
  @HttpCode(204)
  remove(@Param('id') id: string): Promise<void> {
    return this.service.remove(id);
  }
}

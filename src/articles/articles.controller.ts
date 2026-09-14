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
import { ArticlesService, ArticleView } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { ListArticlesDto } from './dto/list-articles.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { VisibilityDto } from '../common/dto/visibility.dto';
import { clampListQuery } from '../common/pagination/clamp-list-query';
import type { ListResult } from '../common/pagination/paginate.util';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';

@Controller('articles')
export class ArticlesController {
  constructor(private readonly service: ArticlesService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  list(
    @Query() query: ListArticlesDto,
    @CurrentUser() user?: AuthUser,
  ): Promise<ListResult<ArticleView>> {
    const isAdmin = Boolean(user);
    return this.service.list(clampListQuery(query, isAdmin) as ListArticlesDto, isAdmin);
  }

  @Get(':idOrSlug/related')
  related(@Param('idOrSlug') idOrSlug: string): Promise<ArticleView[]> {
    return this.service.related(idOrSlug);
  }

  @Get(':idOrSlug')
  @UseGuards(OptionalJwtAuthGuard)
  findOne(
    @Param('idOrSlug') idOrSlug: string,
    @CurrentUser() user?: AuthUser,
  ): Promise<ArticleView> {
    return this.service.findOne(idOrSlug, { isAdmin: Boolean(user), countView: true });
  }

  @Post()
  @AdminOnly()
  create(@Body() dto: CreateArticleDto): Promise<ArticleView> {
    return this.service.create({ ...dto });
  }

  @Put(':id')
  @AdminOnly()
  update(@Param('id') id: string, @Body() dto: UpdateArticleDto): Promise<ArticleView> {
    return this.service.update(id, { ...dto });
  }

  @Patch(':id')
  @AdminOnly()
  patch(@Param('id') id: string, @Body() dto: UpdateArticleDto): Promise<ArticleView> {
    return this.service.update(id, { ...dto });
  }

  @Patch(':id/visibility')
  @AdminOnly()
  setVisibility(@Param('id') id: string, @Body() dto: VisibilityDto): Promise<ArticleView> {
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
  restore(@Param('id') id: string): Promise<ArticleView> {
    return this.service.restore(id);
  }
}

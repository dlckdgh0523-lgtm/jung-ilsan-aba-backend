import { PartialType } from '@nestjs/mapped-types';
import { CreateArticleCategoryDto } from './create-article-category.dto';

export class UpdateArticleCategoryDto extends PartialType(CreateArticleCategoryDto) {}

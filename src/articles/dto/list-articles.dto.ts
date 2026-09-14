import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/**
 * Must be a CLASS extending PaginationQueryDto: with a plain interface the
 * ValidationPipe can't apply the page/pageSize defaults and @Type coercion,
 * and skipTake(undefined, undefined) sends skip: NaN into Prisma.
 */
export class ListArticlesDto extends PaginationQueryDto {
  /** Category id or slug. */
  @IsOptional()
  @IsString()
  category?: string;

  /** Tag id or slug. */
  @IsOptional()
  @IsString()
  tag?: string;

  /** draft | published | all (non-admins are clamped to published). */
  @IsOptional()
  @IsIn(['draft', 'published', 'all'])
  status?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  featured?: string;
}

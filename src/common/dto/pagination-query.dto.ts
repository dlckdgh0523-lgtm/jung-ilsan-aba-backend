import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export type VisibleFilter = 'true' | 'false' | 'all';
export type TrashedFilter = 'none' | 'with' | 'only';

/** Shared query params for list endpoints (see API_SPEC §0.1). */
export class PaginationQueryDto {
  // @Type forces string→number coercion for query params (don't rely on
  // enableImplicitConversion alone — it doesn't fire reliably for @Query DTOs).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  /** e.g. "order:asc", "createdAt:desc" */
  @IsOptional()
  @IsString()
  sort?: string;

  /** free-text search over title/name/body */
  @IsOptional()
  @IsString()
  q?: string;

  /** true | false | all  (all requires admin) */
  @IsOptional()
  @IsIn(['true', 'false', 'all'])
  visible?: VisibleFilter;

  /** none (default) | with | only */
  @IsOptional()
  @IsIn(['none', 'with', 'only'])
  trashed?: TrashedFilter;
}

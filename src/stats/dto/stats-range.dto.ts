import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** `GET /stats/range?days=N` — daily buckets for the last N days (KST). */
export class StatsRangeDto {
  // @Type coerces the query string → number (enableImplicitConversion is unreliable for @Query).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  days = 7;
}

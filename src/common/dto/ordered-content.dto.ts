import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** Admin-managed fields shared by every ordered, toggleable collection. */
export class OrderedContentDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;
}

import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

/** Admin-managed fields shared by every ordered, toggleable collection. */
export class OrderedContentDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;
}

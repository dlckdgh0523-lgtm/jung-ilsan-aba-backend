import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/** PATCH /nav/:id — rename / toggle / position a navigation item (no create; ids are semantic). */
export class UpdateNavDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

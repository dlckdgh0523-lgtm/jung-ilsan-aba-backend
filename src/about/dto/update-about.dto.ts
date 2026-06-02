import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

/** PUT /about — singleton; only the provided keys are written. */
export class UpdateAboutDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  eyebrow?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  lead?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  body?: string[];

  /** [{ ko, en, desc }] — shape owned by the frontend, validated loosely. */
  @IsOptional()
  @IsArray()
  values?: Record<string, unknown>[];
}

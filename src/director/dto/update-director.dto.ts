import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * PUT /director — singleton. Accepts EITHER `organizations` (admin form) or `societies`
 * (public read shape); the service stores one column and exposes both. Only provided keys written.
 */
export class UpdateDirectorDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  role?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  sub?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  photo?: string;

  /** [{ code, desc }] */
  @IsOptional()
  @IsArray()
  certifications?: Record<string, unknown>[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  education?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  organizations?: string[];

  /** Input alias for `organizations` (the public screen reads this name). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  societies?: string[];

  /** [{ period, text }] */
  @IsOptional()
  @IsArray()
  career?: Record<string, unknown>[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  awards?: string[];

  /** [{ year, title }] */
  @IsOptional()
  @IsArray()
  papers?: Record<string, unknown>[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  training?: string[];
}

import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

/** PUT /center-info — singleton; only provided keys written. Object-array shapes owned by frontend. */
export class UpdateCenterInfoDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  eyebrow?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  sub?: string;

  /** [{ icon, title, desc }] */
  @IsOptional()
  @IsArray()
  highlights?: Record<string, unknown>[];

  /** [{ name, time, consult }] */
  @IsOptional()
  @IsArray()
  earlyClasses?: Record<string, unknown>[];

  /** [{ name, time, consult }] */
  @IsOptional()
  @IsArray()
  individualSessions?: Record<string, unknown>[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  closingNote?: string;
}

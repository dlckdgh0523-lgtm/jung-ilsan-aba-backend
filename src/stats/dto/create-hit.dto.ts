import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Public page-view ping. `session` is a client-persisted visitor id; falls back to IP. */
export class CreateHitDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  path?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  session?: string;
}

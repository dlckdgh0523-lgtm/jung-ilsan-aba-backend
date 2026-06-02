import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/** Admin edits: workflow `status` and the read flag (accepts `read` or `isRead`). */
export class UpdateConsultationDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: string;

  @IsOptional()
  @IsBoolean()
  read?: boolean;

  @IsOptional()
  @IsBoolean()
  isRead?: boolean;
}

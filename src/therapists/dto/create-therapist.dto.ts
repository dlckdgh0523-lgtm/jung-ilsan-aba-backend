import { IsArray, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { OrderedContentDto } from '../../common/dto/ordered-content.dto';

export class CreateTherapistDto extends OrderedContentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  role?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  tone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  photo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  summary?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  education?: string[];

  /** [{ period, text }] — shape owned by the frontend, validated loosely. */
  @IsOptional()
  @IsArray()
  career?: Record<string, unknown>[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  certifications?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  teaching?: string[];

  /** [{ year, title }] — shape owned by the frontend, validated loosely. */
  @IsOptional()
  @IsArray()
  papers?: Record<string, unknown>[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  completion?: string;
}

import { IsArray, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { OrderedContentDto } from '../../common/dto/ordered-content.dto';

export class CreateProgramDto extends OrderedContentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ageRange?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  photo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  desc?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  icon?: string;

  /** Drives card styling: orange | green | yellow | green-soft. Kept loose for CMS flexibility. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  tone?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  meta?: string;

  /** { intro, sections: [{ heading, body }] } — shape owned by the frontend, validated loosely. */
  @IsOptional()
  @IsObject()
  detail?: Record<string, unknown>;
}

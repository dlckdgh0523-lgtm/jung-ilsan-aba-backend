import { IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderedContentDto } from '../../common/dto/ordered-content.dto';

export class CreateGalleryDto extends OrderedContentDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  src?: string;

  /** Caption. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  /** Longer description shown in the lightbox (plain text, line breaks kept). */
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  body?: string;

  /** Grid column span: 1 or 2. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2)
  span?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

import { IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
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

  /** Grid column span: 1 or 2. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2)
  span?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

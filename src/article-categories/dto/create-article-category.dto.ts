import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { OrderedContentDto } from '../../common/dto/ordered-content.dto';

export class CreateArticleCategoryDto extends OrderedContentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  /** Optional — derived from name when omitted. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(/^[a-z0-9가-힣ㄱ-ㅎㅏ-ㅣ-]+$/, {
    message: 'slug는 소문자·숫자·한글·하이픈만 허용됩니다',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

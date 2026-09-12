import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export const TAG_TYPES = ['LOCATION', 'SERVICE', 'CONDITION', 'AUDIENCE', 'TOPIC'] as const;
export type TagType = (typeof TAG_TYPES)[number];

export class CreateTagDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
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
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  seoDescription?: string;

  @IsOptional()
  @IsIn(TAG_TYPES)
  tagType?: TagType;

  @IsOptional()
  @IsBoolean()
  seoIndexed?: boolean;
}

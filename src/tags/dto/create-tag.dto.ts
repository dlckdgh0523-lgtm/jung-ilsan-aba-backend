import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export const TAG_TYPES = ['LOCATION', 'SERVICE', 'CONDITION', 'AUDIENCE', 'TOPIC'] as const;
export type TagType = (typeof TAG_TYPES)[number];

export class CreateTagDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name!: string;

  /**
   * Optional — derived from name when omitted. No format check here: the
   * service runs slugify() on whatever arrives (spaces/uppercase included),
   * so rejecting at the DTO only produced opaque 422s from the admin page.
   */
  @IsOptional()
  @IsString()
  @MaxLength(120)
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

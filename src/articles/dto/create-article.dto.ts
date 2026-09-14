import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { OrderedContentDto } from '../../common/dto/ordered-content.dto';

/** Per-post tag cap (was 8; raised to 30 by owner request, 2026-09-15). */
export const ARTICLE_MAX_TAGS = 30;

export class CreateArticleDto extends OrderedContentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title!: string;

  /** Optional — derived from title when omitted. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(/^[a-z0-9가-힣ㄱ-ㅎㅏ-ㅣ-]+$/, {
    message: 'slug는 소문자·숫자·한글·하이픈만 허용됩니다',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  excerpt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200000)
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  thumbnail?: string;

  @IsOptional()
  @IsString()
  categoryId?: string | null;

  // ── SEO ──
  @IsOptional()
  @IsString()
  @MaxLength(200)
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  seoDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  canonicalUrl?: string;

  // ── GEO ──
  @IsOptional()
  @IsString()
  @MaxLength(200)
  targetAudience?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  relatedProgram?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  relatedLocation?: string;

  /** [{ q, a }] — rendered on the page AND mirrored into FAQPage JSON-LD. */
  @IsOptional()
  @IsArray()
  faqItems?: Record<string, unknown>[];

  @IsOptional()
  @IsIn(['Article', 'FAQPage'])
  structuredDataType?: string;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  // ── Publishing ──
  @IsOptional()
  @IsIn(['draft', 'published'])
  status?: string;

  /** Tag ids to link (max 8). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(ARTICLE_MAX_TAGS, {
    message: `태그는 게시글당 최대 ${ARTICLE_MAX_TAGS}개까지입니다`,
  })
  @IsString({ each: true })
  tagIds?: string[];
}

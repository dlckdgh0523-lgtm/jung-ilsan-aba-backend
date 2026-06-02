import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Popups are date-windowed banners. They have NO `visible` column (the frontend
 * toggles `isActive` instead), so this does NOT extend OrderedContentDto.
 * `startAt`/`endAt` are date-only strings; the frontend appends "T00:00:00".
 */
export class CreatePopupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  linkUrl?: string;

  @IsString()
  @Matches(DATE_ONLY, { message: 'startAt must be a YYYY-MM-DD date' })
  startAt!: string;

  @IsString()
  @Matches(DATE_ONLY, { message: 'endAt must be a YYYY-MM-DD date' })
  endAt!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  allowHideToday?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

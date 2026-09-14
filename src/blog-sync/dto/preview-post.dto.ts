import { IsString, IsUrl, MaxLength } from 'class-validator';

export class PreviewPostDto {
  /** A Naver blog post URL (PC, mobile, or PostView form) — parser debugging aid. */
  @IsString()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  url!: string;
}

import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** `PUT /privacy/{kind}` — replace the document text; `version` is the effective-date label. */
export class UpdatePrivacyDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  version?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  body!: string;
}

import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Public intake body from the contact form. Field names mirror the frontend
 * payload (`age`, `note`) rather than the DB columns (`childAge`, `message`);
 * the service maps them. `privacyConsent` is validated as a boolean here but
 * its truthiness is enforced in the service so we can return a specific code.
 */
export class CreateConsultationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  parent!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  phone!: string;

  /** Frontend `age` select, e.g. "만 4세" (free string). */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  age?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  childDiagnosis?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string;

  /** Program title text, or "아직 잘 모르겠어요". */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  topic?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferred?: string[];

  /** Frontend `note` textarea. */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string;

  @IsOptional()
  @IsBoolean()
  privacyConsent?: boolean;
}

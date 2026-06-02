import { IsObject, IsOptional } from 'class-validator';

/**
 * PUT /site — both are shallow-merged over the stored values, so a partial save
 * (e.g. the About admin form sending only a few brand fields) never drops the rest.
 */
export class UpdateSiteDto {
  @IsOptional()
  @IsObject()
  brand?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  sections?: Record<string, unknown>;
}

import { IsBoolean } from 'class-validator';

/** Body for `PATCH /<resource>/{id}/visibility` (API_SPEC §0.5). */
export class VisibilityDto {
  @IsBoolean()
  visible!: boolean;
}

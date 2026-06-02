import { IsBoolean } from 'class-validator';

/** Body for `PATCH /popups/{id}/active` — popups toggle `isActive`, not `visible`. */
export class ActiveDto {
  @IsBoolean()
  isActive!: boolean;
}

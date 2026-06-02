import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

/** Body for `PUT /<resource>/order` — ids in desired order (API_SPEC §0.4). */
export class ReorderDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];
}

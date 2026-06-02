import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/** Admin list filters on top of the shared pagination/search/trashed params. */
export class ListConsultationsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  /** Filter by read flag. */
  @IsOptional()
  @IsIn(['true', 'false'])
  read?: 'true' | 'false';
}

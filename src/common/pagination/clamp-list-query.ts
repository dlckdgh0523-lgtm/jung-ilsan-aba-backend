import { PaginationQueryDto } from '../dto/pagination-query.dto';

/**
 * Non-admin callers may only ever see visible, non-trashed rows.
 * Admins keep whatever `visible`/`trashed` filters they requested.
 */
export function clampListQuery(query: PaginationQueryDto, isAdmin: boolean): PaginationQueryDto {
  if (isAdmin) return query;
  return { ...query, visible: 'true', trashed: 'none' };
}

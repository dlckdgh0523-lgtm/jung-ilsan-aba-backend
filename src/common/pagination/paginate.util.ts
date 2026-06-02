import type { TrashedFilter, VisibleFilter } from '../dto/pagination-query.dto';

export interface ListResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export function listResult<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): ListResult<T> {
  return { items, page, pageSize, total };
}

export function skipTake(page: number, pageSize: number): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

/** Parse "field:dir" into a Prisma orderBy, restricted to an allow-list. */
export function parseSort(
  sort: string | undefined,
  allowed: readonly string[],
  fallback: Record<string, 'asc' | 'desc'>,
): Record<string, 'asc' | 'desc'> {
  if (!sort) return fallback;
  const [field, dir] = sort.split(':');
  if (!allowed.includes(field)) return fallback;
  return { [field]: dir === 'desc' ? 'desc' : 'asc' };
}

/** Translate the `visible` query filter into a Prisma where fragment. */
export function visibleWhere(visible: VisibleFilter | undefined): { visible?: boolean } {
  if (visible === 'all') return {};
  if (visible === 'false') return { visible: false };
  return { visible: true };
}

/** Translate the `trashed` query filter into a soft-delete where fragment. */
export function trashedWhere(trashed: TrashedFilter | undefined): {
  deletedAt?: null | { not: null };
} {
  if (trashed === 'with') return {};
  if (trashed === 'only') return { deletedAt: { not: null } };
  return { deletedAt: null };
}

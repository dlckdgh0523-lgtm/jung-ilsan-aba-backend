/**
 * Minimal structural view of a Prisma delegate for single-row ("singleton") models
 * (site_settings, about, director, center_info). Concrete services assign their
 * delegate with `as unknown as SingletonDelegate<Row>` — this keeps Prisma's strict
 * per-model JSON input types from leaking into the merge/upsert logic.
 */
export interface SingletonDelegate<T> {
  findUnique(args: { where: { id: string } }): Promise<T | null>;
  upsert(args: {
    where: { id: string };
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  }): Promise<T>;
}

/** Shallow-merge a partial patch over the existing JSON value (used for brand/sections). */
export function mergeJson(
  existing: unknown,
  patch: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const base = (existing && typeof existing === 'object' ? existing : {}) as Record<
    string,
    unknown
  >;
  return { ...base, ...(patch ?? {}) };
}

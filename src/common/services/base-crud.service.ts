import { PaginationQueryDto } from '../dto/pagination-query.dto';
import { AppException } from '../exceptions/app.exception';
import {
  listResult,
  type ListResult,
  parseSort,
  skipTake,
  trashedWhere,
  visibleWhere,
} from '../pagination/paginate.util';

type SortDir = 'asc' | 'desc';
type Where = Record<string, unknown>;

/**
 * Minimal structural view of a Prisma model delegate. Concrete services assign
 * their delegate with `as unknown as CrudDelegate<Row>` — Prisma's per-model
 * argument types are too strict to assign structurally, so the cast is contained here.
 */
export interface CrudDelegate<T> {
  findMany(args: {
    where?: Where;
    orderBy?: Record<string, SortDir> | Record<string, SortDir>[];
    skip?: number;
    take?: number;
  }): Promise<T[]>;
  findFirst(args: { where?: Where }): Promise<T | null>;
  count(args: { where?: Where }): Promise<number>;
  create(args: { data: Where }): Promise<T>;
  update(args: { where: Where; data: Where }): Promise<T>;
  updateMany(args: { where?: Where; data: Where }): Promise<{ count: number }>;
  delete(args: { where: Where }): Promise<T>;
}

export interface CrudConfig {
  /** String columns matched (case-insensitive `contains`) against the `q` query param. */
  searchFields?: readonly string[];
  /** Columns allowed in the `sort` query param. */
  sortable?: readonly string[];
  defaultSort?: Record<string, SortDir>;
  /** Human label used in 404 messages. */
  label?: string;
  /** Set false for models without a `visible` column (e.g. popups use `isActive`). Default true. */
  hasVisible?: boolean;
}

/**
 * Shared CRUD for ordered, soft-deletable, toggleable collections
 * (hero, programs, therapists, notices, gallery, ...).
 */
export abstract class BaseCrudService<T extends { id: string }> {
  protected constructor(
    protected readonly delegate: CrudDelegate<T>,
    protected readonly config: CrudConfig = {},
  ) {}

  private get sortable(): readonly string[] {
    return this.config.sortable ?? ['order', 'createdAt', 'updatedAt'];
  }
  private get defaultSort(): Record<string, SortDir> {
    return this.config.defaultSort ?? { order: 'asc' };
  }
  private get label(): string {
    return this.config.label ?? 'Resource';
  }

  protected searchWhere(q?: string): Where {
    const fields = this.config.searchFields ?? [];
    if (!q || fields.length === 0) return {};
    return { OR: fields.map((f) => ({ [f]: { contains: q, mode: 'insensitive' } })) };
  }

  async list(query: PaginationQueryDto): Promise<ListResult<T>> {
    const where: Where = {
      ...trashedWhere(query.trashed),
      ...(this.config.hasVisible === false ? {} : visibleWhere(query.visible)),
      ...this.searchWhere(query.q),
    };
    const orderBy = parseSort(query.sort, this.sortable, this.defaultSort);
    const { skip, take } = skipTake(query.page, query.pageSize);
    const [items, total] = await Promise.all([
      this.delegate.findMany({ where, orderBy, skip, take }),
      this.delegate.count({ where }),
    ]);
    return listResult(items, total, query.page, query.pageSize);
  }

  async findOne(id: string, opts: { withTrashed?: boolean } = {}): Promise<T> {
    const where: Where = opts.withTrashed ? { id } : { id, deletedAt: null };
    const found = await this.delegate.findFirst({ where });
    if (!found) throw AppException.notFound(`${this.label} not found`);
    return found;
  }

  /** Next order value (append to end of the list). */
  protected async nextOrder(): Promise<number> {
    const [last] = await this.delegate.findMany({ orderBy: { order: 'desc' }, take: 1 });
    const lastOrder = (last as { order?: number } | undefined)?.order;
    return (typeof lastOrder === 'number' ? lastOrder : -1) + 1;
  }

  async create(data: Where): Promise<T> {
    const payload: Where = { ...data };
    if (payload.order === undefined) payload.order = await this.nextOrder();
    return this.delegate.create({ data: payload });
  }

  /** Used by both PUT (full) and PATCH (partial) — Prisma only writes provided keys. */
  async update(id: string, data: Where): Promise<T> {
    await this.findOne(id);
    return this.delegate.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<void> {
    const { count } = await this.delegate.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (count === 0) throw AppException.notFound(`${this.label} not found`);
  }

  async restore(id: string): Promise<T> {
    const { count } = await this.delegate.updateMany({
      where: { id, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    if (count === 0) throw AppException.notFound(`${this.label} not found or not deleted`);
    return this.findOne(id, { withTrashed: true });
  }

  async hardDelete(id: string): Promise<void> {
    try {
      await this.delegate.delete({ where: { id } });
    } catch {
      throw AppException.notFound(`${this.label} not found`);
    }
  }

  async setVisibility(id: string, visible: boolean): Promise<T> {
    await this.findOne(id);
    return this.delegate.update({ where: { id }, data: { visible } });
  }

  async reorder(ids: string[]): Promise<void> {
    await Promise.all(
      ids.map((id, index) => this.delegate.updateMany({ where: { id }, data: { order: index } })),
    );
  }
}

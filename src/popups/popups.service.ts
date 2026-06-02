import { Injectable } from '@nestjs/common';
import { Popup } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { ListResult } from '../common/pagination/paginate.util';
import { BaseCrudService, type CrudDelegate } from '../common/services/base-crud.service';

export type PopupStatus = 'deleted' | 'inactive' | 'scheduled' | 'ended' | 'active';

/** Popup row + a server-computed `status` (additive; the frontend recomputes its own label). */
export type PopupView = Popup & { status: PopupStatus };

@Injectable()
export class PopupsService extends BaseCrudService<Popup> {
  constructor(prisma: PrismaService) {
    super(prisma.popup as unknown as CrudDelegate<Popup>, {
      searchFields: ['title', 'content'],
      sortable: ['order', 'createdAt', 'updatedAt', 'startAt', 'endAt', 'title'],
      defaultSort: { order: 'asc' },
      label: '팝업',
      hasVisible: false,
    });
  }

  /** Date-only string in KST (UTC+9) — the center operates in Korea. */
  private kstToday(): string {
    return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  private statusOf(p: Popup): PopupStatus {
    if (p.deletedAt) return 'deleted';
    if (!p.isActive) return 'inactive';
    const today = this.kstToday();
    if (p.startAt && today < p.startAt) return 'scheduled';
    if (p.endAt && today > p.endAt) return 'ended';
    return 'active';
  }

  private withStatus(p: Popup): PopupView {
    return { ...p, status: this.statusOf(p) };
  }

  /**
   * Public list of currently-showable popups — mirrors the frontend
   * `popupIsShowable` filter (not deleted, active, today within [startAt, endAt]).
   * Date-only strings compare lexicographically, which is chronological for YYYY-MM-DD.
   */
  async listActive(): Promise<PopupView[]> {
    const today = this.kstToday();
    const rows = await this.delegate.findMany({
      where: { deletedAt: null, isActive: true, startAt: { lte: today }, endAt: { gte: today } },
      orderBy: { order: 'asc' },
    });
    return rows.map((p) => this.withStatus(p));
  }

  async listView(query: PaginationQueryDto): Promise<ListResult<PopupView>> {
    const res = await this.list(query);
    return { ...res, items: res.items.map((p) => this.withStatus(p)) };
  }

  async findOneView(id: string, opts: { withTrashed?: boolean } = {}): Promise<PopupView> {
    return this.withStatus(await this.findOne(id, opts));
  }

  async createPopup(data: Record<string, unknown>): Promise<PopupView> {
    return this.withStatus(await this.create(data));
  }

  async updatePopup(id: string, data: Record<string, unknown>): Promise<PopupView> {
    return this.withStatus(await this.update(id, data));
  }

  async setActive(id: string, isActive: boolean): Promise<PopupView> {
    await this.findOne(id);
    const row = await this.delegate.update({ where: { id }, data: { isActive } });
    return this.withStatus(row);
  }

  async restorePopup(id: string): Promise<PopupView> {
    return this.withStatus(await this.restore(id));
  }
}

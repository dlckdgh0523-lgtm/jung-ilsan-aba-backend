import { Injectable } from '@nestjs/common';
import { NavItem } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { CrudDelegate } from '../common/services/base-crud.service';
import { UpdateNavDto } from './dto/update-nav.dto';

/** Navigation items have semantic ids and no soft-delete; managed in place (no create). */
@Injectable()
export class NavService {
  private readonly delegate: CrudDelegate<NavItem>;

  constructor(prisma: PrismaService) {
    this.delegate = prisma.navItem as unknown as CrudDelegate<NavItem>;
  }

  list(isAdmin: boolean): Promise<NavItem[]> {
    return this.delegate.findMany({
      where: isAdmin ? {} : { visible: true },
      orderBy: { order: 'asc' },
    });
  }

  private async ensure(id: string): Promise<NavItem> {
    const found = await this.delegate.findFirst({ where: { id } });
    if (!found) throw AppException.notFound('메뉴 항목을 찾을 수 없습니다.');
    return found;
  }

  async update(id: string, dto: UpdateNavDto): Promise<NavItem> {
    await this.ensure(id);
    return this.delegate.update({ where: { id }, data: { ...dto } });
  }

  async setVisibility(id: string, visible: boolean): Promise<NavItem> {
    await this.ensure(id);
    return this.delegate.update({ where: { id }, data: { visible } });
  }

  async remove(id: string): Promise<void> {
    await this.ensure(id);
    await this.delegate.delete({ where: { id } });
  }

  async reorder(ids: string[]): Promise<void> {
    await Promise.all(
      ids.map((id, index) => this.delegate.updateMany({ where: { id }, data: { order: index } })),
    );
  }
}

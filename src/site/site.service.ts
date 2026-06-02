import { Injectable } from '@nestjs/common';
import { NavItem, SiteSetting } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { mergeJson, SingletonDelegate } from '../common/services/singleton.util';
import { NavService } from './nav.service';
import { UpdateSiteDto } from './dto/update-site.dto';

const SINGLETON_ID = 'singleton';

export interface SitePayload {
  brand: Record<string, unknown>;
  nav: NavItem[];
  sections: Record<string, unknown>;
}

@Injectable()
export class SiteService {
  private readonly delegate: SingletonDelegate<SiteSetting>;

  constructor(
    prisma: PrismaService,
    private readonly nav: NavService,
  ) {
    this.delegate = prisma.siteSetting as unknown as SingletonDelegate<SiteSetting>;
  }

  async getSite(isAdmin: boolean): Promise<SitePayload> {
    const [row, nav] = await Promise.all([
      this.delegate.findUnique({ where: { id: SINGLETON_ID } }),
      this.nav.list(isAdmin),
    ]);
    return {
      brand: mergeJson(row?.brand, undefined),
      nav,
      sections: mergeJson(row?.sections, undefined),
    };
  }

  async updateSite(dto: UpdateSiteDto): Promise<SitePayload> {
    const row = await this.delegate.findUnique({ where: { id: SINGLETON_ID } });
    const brand = mergeJson(row?.brand, dto.brand);
    const sections = mergeJson(row?.sections, dto.sections);
    await this.delegate.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, brand, sections },
      update: { brand, sections },
    });
    return this.getSite(true);
  }
}

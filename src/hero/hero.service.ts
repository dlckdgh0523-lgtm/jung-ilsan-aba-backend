import { Injectable } from '@nestjs/common';
import { HeroSlide } from '@prisma/client';
import { BaseCrudService, CrudDelegate } from '../common/services/base-crud.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HeroService extends BaseCrudService<HeroSlide> {
  constructor(prisma: PrismaService) {
    super(prisma.heroSlide as unknown as CrudDelegate<HeroSlide>, {
      searchFields: ['title', 'subtitle', 'eyebrow'],
      sortable: ['order', 'createdAt', 'updatedAt', 'title'],
      defaultSort: { order: 'asc' },
      label: '히어로 슬라이드',
    });
  }
}

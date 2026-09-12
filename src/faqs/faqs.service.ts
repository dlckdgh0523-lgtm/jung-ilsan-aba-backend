import { Injectable } from '@nestjs/common';
import { FaqItem } from '@prisma/client';
import { BaseCrudService, CrudDelegate } from '../common/services/base-crud.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FaqsService extends BaseCrudService<FaqItem> {
  constructor(prisma: PrismaService) {
    super(prisma.faqItem as unknown as CrudDelegate<FaqItem>, {
      searchFields: ['question', 'answer'],
      sortable: ['order', 'createdAt', 'updatedAt'],
      defaultSort: { order: 'asc' },
      label: 'FAQ',
    });
  }
}

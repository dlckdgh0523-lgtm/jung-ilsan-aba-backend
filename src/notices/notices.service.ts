import { Injectable } from '@nestjs/common';
import { Notice } from '@prisma/client';
import { BaseCrudService, CrudDelegate } from '../common/services/base-crud.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NoticesService extends BaseCrudService<Notice> {
  constructor(prisma: PrismaService) {
    super(prisma.notice as unknown as CrudDelegate<Notice>, {
      searchFields: ['title', 'body'],
      sortable: ['order', 'createdAt', 'updatedAt', 'pinned', 'views', 'date', 'title'],
      defaultSort: { order: 'asc' },
      label: '공지사항',
    });
  }
}

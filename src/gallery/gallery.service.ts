import { Injectable } from '@nestjs/common';
import { GalleryItem } from '@prisma/client';
import { BaseCrudService, CrudDelegate } from '../common/services/base-crud.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GalleryService extends BaseCrudService<GalleryItem> {
  constructor(prisma: PrismaService) {
    super(prisma.galleryItem as unknown as CrudDelegate<GalleryItem>, {
      searchFields: ['title'],
      sortable: ['order', 'createdAt', 'updatedAt', 'title'],
      defaultSort: { order: 'asc' },
      label: '갤러리 항목',
    });
  }
}

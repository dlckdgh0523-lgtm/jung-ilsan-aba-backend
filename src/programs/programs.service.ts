import { Injectable } from '@nestjs/common';
import { Program } from '@prisma/client';
import { BaseCrudService, CrudDelegate } from '../common/services/base-crud.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProgramsService extends BaseCrudService<Program> {
  constructor(prisma: PrismaService) {
    super(prisma.program as unknown as CrudDelegate<Program>, {
      searchFields: ['title', 'desc', 'ageRange'],
      sortable: ['order', 'createdAt', 'updatedAt', 'title'],
      defaultSort: { order: 'asc' },
      label: '프로그램',
    });
  }
}

import { Injectable } from '@nestjs/common';
import { Therapist } from '@prisma/client';
import { BaseCrudService, CrudDelegate } from '../common/services/base-crud.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TherapistsService extends BaseCrudService<Therapist> {
  constructor(prisma: PrismaService) {
    super(prisma.therapist as unknown as CrudDelegate<Therapist>, {
      searchFields: ['name', 'summary', 'role'],
      sortable: ['order', 'createdAt', 'updatedAt', 'name'],
      defaultSort: { order: 'asc' },
      label: '치료사',
    });
  }
}

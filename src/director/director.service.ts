import { Injectable } from '@nestjs/common';
import { Director } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SingletonDelegate } from '../common/services/singleton.util';
import { UpdateDirectorDto } from './dto/update-director.dto';

const SINGLETON_ID = 'singleton';

/** Public/admin view: `societies` mirrors the stored `organizations` column. */
export type DirectorView = Director & { societies: Director['organizations'] };

@Injectable()
export class DirectorService {
  private readonly delegate: SingletonDelegate<Director>;

  constructor(prisma: PrismaService) {
    this.delegate = prisma.director as unknown as SingletonDelegate<Director>;
  }

  private withAlias(row: Director): DirectorView {
    return { ...row, societies: row.organizations };
  }

  async get(): Promise<DirectorView> {
    const row = await this.delegate.findUnique({ where: { id: SINGLETON_ID } });
    if (row) return this.withAlias(row);
    const created = await this.delegate.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID },
      update: {},
    });
    return this.withAlias(created);
  }

  async update(dto: UpdateDirectorDto): Promise<DirectorView> {
    const { societies, ...rest } = dto;
    const data: Record<string, unknown> = { ...rest };
    if (data.organizations === undefined && societies !== undefined) {
      data.organizations = societies;
    }
    const row = await this.delegate.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...data },
      update: data,
    });
    return this.withAlias(row);
  }
}

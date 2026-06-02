import { Injectable } from '@nestjs/common';
import { CenterInfo } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SingletonDelegate } from '../common/services/singleton.util';
import { UpdateCenterInfoDto } from './dto/update-center-info.dto';

const SINGLETON_ID = 'singleton';

@Injectable()
export class CenterInfoService {
  private readonly delegate: SingletonDelegate<CenterInfo>;

  constructor(prisma: PrismaService) {
    this.delegate = prisma.centerInfo as unknown as SingletonDelegate<CenterInfo>;
  }

  async get(): Promise<CenterInfo> {
    const row = await this.delegate.findUnique({ where: { id: SINGLETON_ID } });
    if (row) return row;
    return this.delegate.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID },
      update: {},
    });
  }

  update(dto: UpdateCenterInfoDto): Promise<CenterInfo> {
    const data: Record<string, unknown> = { ...dto };
    return this.delegate.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...data },
      update: data,
    });
  }
}

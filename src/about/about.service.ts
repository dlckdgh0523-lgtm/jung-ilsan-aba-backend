import { Injectable } from '@nestjs/common';
import { About } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SingletonDelegate } from '../common/services/singleton.util';
import { UpdateAboutDto } from './dto/update-about.dto';

const SINGLETON_ID = 'singleton';

@Injectable()
export class AboutService {
  private readonly delegate: SingletonDelegate<About>;

  constructor(prisma: PrismaService) {
    this.delegate = prisma.about as unknown as SingletonDelegate<About>;
  }

  /** Lazily materialises the singleton so the public shape is always consistent. */
  async get(): Promise<About> {
    const row = await this.delegate.findUnique({ where: { id: SINGLETON_ID } });
    if (row) return row;
    return this.delegate.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID },
      update: {},
    });
  }

  update(dto: UpdateAboutDto): Promise<About> {
    const data: Record<string, unknown> = { ...dto };
    return this.delegate.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...data },
      update: data,
    });
  }
}

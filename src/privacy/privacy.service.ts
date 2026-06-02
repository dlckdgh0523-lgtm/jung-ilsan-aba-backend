import { Injectable } from '@nestjs/common';
import { PrivacyDoc } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { UpdatePrivacyDto } from './dto/update-privacy.dto';

const KINDS = ['policy', 'consent'] as const;
type PrivacyKind = (typeof KINDS)[number];

@Injectable()
export class PrivacyService {
  constructor(private readonly prisma: PrismaService) {}

  async get(kind: string): Promise<PrivacyDoc> {
    const k = this.assertKind(kind);
    const doc = await this.prisma.privacyDoc.findUnique({ where: { kind: k } });
    if (!doc) throw AppException.notFound('개인정보 문서를 찾을 수 없습니다.');
    return doc;
  }

  async update(kind: string, dto: UpdatePrivacyDto): Promise<PrivacyDoc> {
    const k = this.assertKind(kind);
    const version = dto.version ?? this.kstToday();
    return this.prisma.privacyDoc.upsert({
      where: { kind: k },
      create: { kind: k, version, body: dto.body },
      update: { body: dto.body, ...(dto.version !== undefined ? { version: dto.version } : {}) },
    });
  }

  private assertKind(kind: string): PrivacyKind {
    if ((KINDS as readonly string[]).includes(kind)) return kind as PrivacyKind;
    throw AppException.notFound('개인정보 문서를 찾을 수 없습니다.');
  }

  private kstToday(): string {
    return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }
}

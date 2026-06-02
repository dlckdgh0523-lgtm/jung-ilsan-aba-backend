import { Injectable } from '@nestjs/common';
import { Consultation, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import {
  listResult,
  type ListResult,
  parseSort,
  skipTake,
  trashedWhere,
} from '../common/pagination/paginate.util';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateConsultationDto } from './dto/create-consultation.dto';
import { UpdateConsultationDto } from './dto/update-consultation.dto';
import { ListConsultationsDto } from './dto/list-consultations.dto';

/**
 * Consultation row plus the frontend-facing aliases the contact UI/admin expect:
 * `age` (childAge), `note` (message), `read` (isRead), `ts` (createdAt epoch ms).
 */
export type ConsultationView = Consultation & {
  age: string | null;
  note: string | null;
  read: boolean;
  ts: number;
};

const SORTABLE = ['createdAt', 'updatedAt', 'status'] as const;

@Injectable()
export class ConsultationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  private toView(c: Consultation): ConsultationView {
    return { ...c, age: c.childAge, note: c.message, read: c.isRead, ts: c.createdAt.getTime() };
  }

  /** Public contact-form intake. Enforces privacy consent, then notifies admins via SSE. */
  async create(
    dto: CreateConsultationDto,
    ip?: string,
    idempotencyKey?: string,
  ): Promise<ConsultationView> {
    if (dto.privacyConsent !== true) {
      throw AppException.unprocessable(
        '개인정보 수집 및 이용에 동의해야 합니다.',
        'PRIVACY_CONSENT_REQUIRED',
        { privacyConsent: '개인정보 수집 및 이용에 동의해 주세요.' },
      );
    }
    const key = idempotencyKey?.trim() || null;
    if (key) {
      // Idempotent replay (double-click / network retry / browser resend) → return the original row.
      const existing = await this.prisma.consultation.findUnique({
        where: { idempotencyKey: key },
      });
      if (existing) return this.toView(existing);
    }
    let created: Consultation;
    try {
      created = await this.prisma.consultation.create({
        data: {
          parent: dto.parent,
          phone: dto.phone,
          childAge: dto.age ?? null,
          childDiagnosis: dto.childDiagnosis ?? null,
          email: dto.email ?? null,
          topic: dto.topic ?? null,
          preferred: dto.preferred ?? [],
          message: dto.note ?? null,
          privacyConsent: true,
          ip: ip ?? null,
          idempotencyKey: key,
        },
      });
    } catch (e) {
      // A concurrent request with the same key won the unique constraint → return the winner.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && key) {
        const existing = await this.prisma.consultation.findUnique({
          where: { idempotencyKey: key },
        });
        if (existing) return this.toView(existing);
      }
      throw e;
    }
    const view = this.toView(created);
    this.realtime.emitConsultation(view);
    return view;
  }

  async list(query: ListConsultationsDto): Promise<ListResult<ConsultationView>> {
    const where: Prisma.ConsultationWhereInput = { ...trashedWhere(query.trashed) };
    if (query.status) where.status = query.status;
    if (query.read === 'true') where.isRead = true;
    if (query.read === 'false') where.isRead = false;
    const q = query.q?.trim();
    if (q) {
      where.OR = [
        { parent: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { topic: { contains: q, mode: 'insensitive' } },
        { message: { contains: q, mode: 'insensitive' } },
      ];
    }
    const orderBy = parseSort(query.sort, SORTABLE, {
      createdAt: 'desc',
    }) as Prisma.ConsultationOrderByWithRelationInput;
    const { skip, take } = skipTake(query.page, query.pageSize);
    const [items, total] = await Promise.all([
      this.prisma.consultation.findMany({ where, orderBy, skip, take }),
      this.prisma.consultation.count({ where }),
    ]);
    return listResult(
      items.map((c) => this.toView(c)),
      total,
      query.page,
      query.pageSize,
    );
  }

  async findOne(id: string, opts: { withTrashed?: boolean } = {}): Promise<ConsultationView> {
    const where: Prisma.ConsultationWhereInput = opts.withTrashed
      ? { id }
      : { id, deletedAt: null };
    const found = await this.prisma.consultation.findFirst({ where });
    if (!found) throw AppException.notFound('상담 신청을 찾을 수 없습니다.');
    return this.toView(found);
  }

  async update(id: string, dto: UpdateConsultationDto): Promise<ConsultationView> {
    await this.findOne(id, { withTrashed: true });
    const data: Prisma.ConsultationUpdateInput = {};
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.read !== undefined) data.isRead = dto.read;
    if (dto.isRead !== undefined) data.isRead = dto.isRead;
    const updated = await this.prisma.consultation.update({ where: { id }, data });
    return this.toView(updated);
  }

  async markRead(id: string, read = true): Promise<ConsultationView> {
    await this.findOne(id, { withTrashed: true });
    const updated = await this.prisma.consultation.update({
      where: { id },
      data: { isRead: read },
    });
    return this.toView(updated);
  }

  async softDelete(id: string): Promise<void> {
    const { count } = await this.prisma.consultation.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (count === 0) throw AppException.notFound('상담 신청을 찾을 수 없습니다.');
  }

  async restore(id: string): Promise<ConsultationView> {
    const { count } = await this.prisma.consultation.updateMany({
      where: { id, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    if (count === 0) throw AppException.notFound('상담 신청을 찾을 수 없거나 삭제되지 않았습니다.');
    return this.findOne(id, { withTrashed: true });
  }

  async hardDelete(id: string): Promise<void> {
    try {
      await this.prisma.consultation.delete({ where: { id } });
    } catch {
      throw AppException.notFound('상담 신청을 찾을 수 없습니다.');
    }
  }
}

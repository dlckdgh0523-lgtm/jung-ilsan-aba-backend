import { ConsultationsService } from './consultations.service';
import { AppException } from '../common/exceptions/app.exception';
import type { CreateConsultationDto } from './dto/create-consultation.dto';

describe('ConsultationsService.create', () => {
  let service: ConsultationsService;
  let prisma: { consultation: { findUnique: jest.Mock; create: jest.Mock } };
  let realtime: { emitConsultation: jest.Mock };

  const dto = {
    parent: '홍길동',
    phone: '010-1234-5678',
    privacyConsent: true,
  } as CreateConsultationDto;
  const row = {
    id: 'c1',
    parent: '홍길동',
    phone: '010-1234-5678',
    childAge: null,
    childDiagnosis: null,
    email: null,
    topic: null,
    preferred: [],
    message: null,
    privacyConsent: true,
    status: 'new',
    isRead: false,
    ip: null,
    idempotencyKey: null,
    deletedAt: null,
    createdAt: new Date('2026-06-02T00:00:00Z'),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prisma = { consultation: { findUnique: jest.fn(), create: jest.fn().mockResolvedValue(row) } };
    realtime = { emitConsultation: jest.fn() };
    service = new ConsultationsService(prisma as never, realtime as never);
  });

  it('throws 422 PRIVACY_CONSENT_REQUIRED without consent', async () => {
    try {
      await service.create({ ...dto, privacyConsent: false }, '1.1.1.1');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppException);
      expect((e as AppException).getStatus()).toBe(422);
      expect((e as AppException).getResponse()).toMatchObject({ code: 'PRIVACY_CONSENT_REQUIRED' });
    }
    expect(prisma.consultation.create).not.toHaveBeenCalled();
  });

  it('creates the row, exposes frontend aliases, and emits a realtime event', async () => {
    const view = await service.create(dto, '1.1.1.1');
    expect(prisma.consultation.create).toHaveBeenCalledTimes(1);
    expect(realtime.emitConsultation).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' }));
    expect(view).toMatchObject({ id: 'c1', read: false, note: null, age: null });
    expect(typeof view.ts).toBe('number');
  });

  it('idempotent: a repeated key returns the original row without creating or emitting again', async () => {
    prisma.consultation.findUnique.mockResolvedValue(row);
    const view = await service.create(dto, '1.1.1.1', 'key-1');
    expect(prisma.consultation.findUnique).toHaveBeenCalledWith({
      where: { idempotencyKey: 'key-1' },
    });
    expect(prisma.consultation.create).not.toHaveBeenCalled();
    expect(realtime.emitConsultation).not.toHaveBeenCalled();
    expect(view.id).toBe('c1');
  });

  it('passes a new idempotency key through to create', async () => {
    prisma.consultation.findUnique.mockResolvedValue(null);
    await service.create(dto, '1.1.1.1', 'fresh-key');
    expect(prisma.consultation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ idempotencyKey: 'fresh-key' }) }),
    );
  });
});

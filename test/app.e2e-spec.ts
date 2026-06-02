import { HttpStatus, INestApplication, ValidationError, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { AppException } from '../src/common/exceptions/app.exception';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';

const flatten = (errors: ValidationError[]): Record<string, string> =>
  Object.fromEntries(
    errors.map((e) => [e.property, Object.values(e.constraints ?? {}).join(', ')]),
  );

describe('API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let token = '';

  const bearer = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        exceptionFactory: (errors) =>
          new AppException(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'VALIDATION',
            'Validation failed',
            flatten(errors),
          ),
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = app.get(PrismaService);
    http = app.getHttpServer();

    // Clean slate + a known admin (matches .env.test creds).
    await prisma.consultation.deleteMany({});
    await prisma.program.deleteMany({});
    await prisma.popup.deleteMany({});
    const passwordHash = await bcrypt.hash('testpass1234', 8);
    await prisma.adminUser.upsert({
      where: { username: 'testadmin' },
      update: { passwordHash, tokenVersion: 0 },
      create: { username: 'testadmin', passwordHash, role: 'admin' },
    });
    await prisma.navItem.deleteMany({});
    await prisma.navItem.createMany({
      data: [
        { id: 'about', label: '센터 소개', order: 0, visible: true },
        { id: 'programs', label: '프로그램', order: 1, visible: true },
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Auth ──
  it('POST /v1/auth/login → token on valid credentials', async () => {
    const res = await request(http)
      .post('/v1/auth/login')
      .send({ username: 'testadmin', password: 'testpass1234' });
    expect([200, 201]).toContain(res.status);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user).toMatchObject({ username: 'testadmin', role: 'admin' });
    token = res.body.token;
  });

  it('POST /v1/auth/login → 401 on wrong password', async () => {
    const res = await request(http)
      .post('/v1/auth/login')
      .send({ username: 'testadmin', password: 'nope' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('GET /v1/consultations without token → 401 (admin guard)', async () => {
    const res = await request(http).get('/v1/consultations');
    expect(res.status).toBe(401);
  });

  // ── Consultations (public intake) ──
  it('POST /v1/consultations without consent → 422 PRIVACY_CONSENT_REQUIRED', async () => {
    const res = await request(http)
      .post('/v1/consultations')
      .send({ parent: '홍', phone: '010-0000-0000' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PRIVACY_CONSENT_REQUIRED');
  });

  it('POST /v1/consultations with consent → created with frontend aliases', async () => {
    const res = await request(http).post('/v1/consultations').send({
      parent: '김부모',
      phone: '010-1111-2222',
      age: '만 4세',
      topic: '초기상담',
      note: 'e2e',
      privacyConsent: true,
    });
    expect([200, 201]).toContain(res.status);
    expect(res.body.id).toBeTruthy();
    expect(res.body).toMatchObject({ read: false, note: 'e2e', age: '만 4세' });
    expect(typeof res.body.ts).toBe('number');
  });

  it('POST /v1/consultations is idempotent under a repeated Idempotency-Key', async () => {
    const body = { parent: '중복', phone: '010-3333-4444', privacyConsent: true };
    const r1 = await request(http)
      .post('/v1/consultations')
      .set('Idempotency-Key', 'e2e-key-1')
      .send(body);
    const r2 = await request(http)
      .post('/v1/consultations')
      .set('Idempotency-Key', 'e2e-key-1')
      .send(body);
    expect(r1.body.id).toBeTruthy();
    expect(r2.body.id).toBe(r1.body.id);
    const count = await prisma.consultation.count({ where: { idempotencyKey: 'e2e-key-1' } });
    expect(count).toBe(1);
  });

  // ── Programs CRUD (admin) ──
  it('full programs CRUD lifecycle', async () => {
    const created = await request(http)
      .post('/v1/programs')
      .set(bearer())
      .send({
        title: 'E2E 프로그램',
        ageRange: '전 연령',
        desc: 'e2e',
        icon: 'sparkles',
        tone: 'orange',
        tags: ['t'],
        meta: 'm',
        detail: { intro: 'i', sections: [] },
        photo: '',
      });
    expect([200, 201]).toContain(created.status);
    const id = created.body.id;
    expect(id).toBeTruthy();

    const list = await request(http).get('/v1/programs?pageSize=50&visible=all').set(bearer());
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.items)).toBe(true);
    expect(typeof list.body.total).toBe('number');
    expect(list.body.items.some((p: { id: string }) => p.id === id)).toBe(true);

    const updated = await request(http)
      .put(`/v1/programs/${id}`)
      .set(bearer())
      .send({ ...created.body, title: 'E2E 수정' });
    expect(updated.body.title).toBe('E2E 수정');

    const vis = await request(http)
      .patch(`/v1/programs/${id}/visibility`)
      .set(bearer())
      .send({ visible: false });
    expect(vis.body.visible).toBe(false);

    const del = await request(http).delete(`/v1/programs/${id}`).set(bearer());
    expect(del.status).toBe(204);
  });

  // ── Popups: active filter ──
  it('GET /v1/popups/active returns currently-showable popups', async () => {
    await request(http)
      .post('/v1/popups')
      .set(bearer())
      .send({ title: 'E2E 활성팝업', startAt: '2000-01-01', endAt: '2999-12-31', isActive: true });
    await request(http)
      .post('/v1/popups')
      .set(bearer())
      .send({ title: 'E2E 예약팝업', startAt: '2999-01-01', endAt: '2999-12-31', isActive: true });

    const res = await request(http).get('/v1/popups/active');
    expect(res.status).toBe(200);
    const titles = (res.body as Array<{ title: string }>).map((p) => p.title);
    expect(titles).toContain('E2E 활성팝업');
    expect(titles).not.toContain('E2E 예약팝업'); // scheduled → not shown
  });

  // ── Broad endpoint coverage (public GETs, admin lists/singletons, nav, stats, privacy, upload) ──
  it('exercises the remaining endpoints end-to-end', async () => {
    for (const p of [
      '/v1/site',
      '/v1/nav',
      '/v1/about',
      '/v1/director',
      '/v1/center-info',
      '/v1/hero',
      '/v1/programs',
      '/v1/therapists',
      '/v1/notices',
      '/v1/gallery',
      '/v1/popups/active',
      '/v1/health',
    ]) {
      const res = await request(http).get(p);
      expect(res.status).toBeLessThan(500);
    }
    for (const p of [
      '/v1/hero',
      '/v1/therapists',
      '/v1/notices',
      '/v1/gallery',
      '/v1/popups',
      '/v1/consultations',
    ]) {
      expect((await request(http).get(`${p}?pageSize=10&visible=all`).set(bearer())).status).toBe(
        200,
      );
    }
    expect(
      (
        await request(http)
          .put('/v1/about')
          .set(bearer())
          .send({ title: 'About x', body: ['p'] })
      ).status,
    ).toBe(200);
    expect(
      (await request(http).put('/v1/director').set(bearer()).send({ name: '원장' })).status,
    ).toBe(200);
    expect(
      (await request(http).put('/v1/center-info').set(bearer()).send({ title: 'Center' })).status,
    ).toBe(200);
    expect(
      (
        await request(http)
          .put('/v1/site')
          .set(bearer())
          .send({ sections: { hero: true } })
      ).status,
    ).toBe(200);

    const nav = (await request(http).get('/v1/nav').set(bearer())).body as Array<{ id: string }>;
    expect(
      (
        await request(http)
          .put('/v1/nav/order')
          .set(bearer())
          .send({ ids: nav.map((n) => n.id) })
      ).status,
    ).toBe(204);
    expect(
      (await request(http).patch(`/v1/nav/${nav[0].id}`).set(bearer()).send({ label: '소개' }))
        .status,
    ).toBe(200);
    expect(
      (
        await request(http)
          .patch(`/v1/nav/${nav[0].id}/visibility`)
          .set(bearer())
          .send({ visible: true })
      ).status,
    ).toBe(200);

    // hero create → soft-delete → restore (exercises BaseCrudService paths)
    const hero = await request(http).post('/v1/hero').set(bearer()).send({
      image: '',
      eyebrow: '',
      title: 'H',
      subtitle: '',
      buttonText: 'b',
      buttonLink: 'about',
    });
    expect([200, 201]).toContain(hero.status);
    expect(
      (
        await request(http)
          .put('/v1/hero/order')
          .set(bearer())
          .send({ ids: [hero.body.id] })
      ).status,
    ).toBe(204);
    expect((await request(http).delete(`/v1/hero/${hero.body.id}`).set(bearer())).status).toBe(204);
    expect([200, 201]).toContain(
      (await request(http).post(`/v1/hero/${hero.body.id}/restore`).set(bearer())).status,
    );

    expect(
      (await request(http).post('/v1/stats/hit').send({ path: '/', session: 'e2e' })).status,
    ).toBe(202);
    expect((await request(http).get('/v1/stats/summary').set(bearer())).status).toBe(200);
    expect((await request(http).get('/v1/stats/range?days=7').set(bearer())).status).toBe(200);

    expect(
      (
        await request(http)
          .put('/v1/privacy/policy')
          .set(bearer())
          .send({ body: '개인정보처리방침 본문' })
      ).status,
    ).toBe(200);
    expect((await request(http).get('/v1/privacy/policy')).status).toBe(200);

    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );
    const up = await request(http).post('/v1/uploads').set(bearer()).attach('file', png, 'x.png');
    expect([200, 201]).toContain(up.status);
    expect(up.body.url).toMatch(/^\/uploads\//);
  });

  // ── Rate limit: consultations capped at 5/min/IP ──
  it('POST /v1/consultations is rate-limited (429 after the cap)', async () => {
    const body = { parent: '폭주', phone: '010-9999-0000', privacyConsent: true };
    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) {
      const res = await request(http).post('/v1/consultations').send(body);
      statuses.push(res.status);
    }
    expect(statuses).toContain(429);
  });
});

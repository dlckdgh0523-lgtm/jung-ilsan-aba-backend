# jung-ilsan-aba-backend

NestJS 11 + Prisma 6 + PostgreSQL. 프론트(관리자페이지 포함)는 별도 레포(Vercel 정적 SPA)로 `/v1` API만 호출한다.

## 테스트 규칙

- **list(목록) 엔드포인트는 반드시 supertest 경유(e2e)로 검증한다.** 서비스에 숫자를 직접 넣는 유닛 테스트는 `@Query()` DTO의 기본값·`@Type` 변환 누락(예: 인터페이스 타입을 받아 `skipTake(undefined, undefined)` → `skip: NaN` → Prisma 400)을 잡지 못한다.
- `@Query() query:`에는 항상 `PaginationQueryDto` 계열 **클래스**를 쓴다. 인터페이스 금지.
- 네트워크는 전부 인터페이스/토큰(`BLOG_FETCH` 등) 뒤에 두고 유닛 테스트에서 목 처리. e2e에서 외부(네이버·솔라피·Anthropic) 호출 금지.

## 게이트

`npm run lint:ci && npm run typecheck && npm test` (유닛) — CI는 추가로 e2e+커버리지(`test:cov`, Postgres 필요). 로컬 재현: postgres:16-alpine 컨테이너(aba/aba_password/aba_test) 띄우고 `DATABASE_URL` 지정 후 `prisma migrate deploy && npm run test:cov`.

## 주의

- 마이그레이션은 수동 SQL 작성(로컬 DB 없음), 배포 시 `prisma migrate deploy` 자동 적용. 추가 전용 유지.
- `sanitize-html`은 2.13.1, `@nestjs/schedule`은 5.0.1 고정 — 상위 버전은 ESM 전용 의존성이라 CJS Jest에서 e2e 스위트가 깨진다.
- 시드 주의: `npm run db:seed`는 콘텐츠를 mock으로 리셋하므로 프로덕션 금지(부팅은 `db:seed:content`만 돌림).

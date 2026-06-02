# 정지은 일산 ABA — 배포 가이드 (Oracle Cloud Ubuntu + Docker)

NestJS + Prisma + PostgreSQL 백엔드를 Docker Compose로 운영 배포하는 절차입니다.
구성: **db**(PostgreSQL) · **app**(Nest API) · **nginx**(정적 프론트 + 리버스 프록시).

---

## 1. 사전 준비 (Oracle Cloud)

1. **Ubuntu 인스턴스 생성** (22.04 LTS 권장, 최소 1 vCPU / 1GB RAM, 디스크 ≥ 30GB).
2. **방화벽 / 보안 목록(Ingress)**: 22(SSH), 80(HTTP), 443(HTTPS)만 개방. **5432(PostgreSQL)는 절대 외부 개방 금지.**
3. 인스턴스 안 Ubuntu 방화벽(iptables/ufw)도 동일하게 80/443/22만 허용.
4. **Docker + Compose 설치**:
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER   # 재로그인 후 sudo 없이 docker 사용
   docker compose version          # v2 플러그인 확인
   ```

## 2. 코드 + 환경 변수

```bash
git clone <repo> aba-backend && cd aba-backend   # 또는 파일 업로드
cp .env.example .env
```

`.env`를 **운영 값으로 수정** (아래는 필수 변경 항목):

| 변수 | 운영 값 |
|------|---------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | 32자 이상 무작위 문자열 — `openssl rand -base64 48` |
| `POSTGRES_PASSWORD` | 강력한 무작위 비밀번호 |
| `ADMIN_DEFAULT_PASSWORD` | `aba1234`에서 **반드시 변경** (최초 시드 때만 사용됨) |
| `CORS_ORIGINS` | 실제 사이트 도메인 (예: `https://aba.example.com`) |

> `DATABASE_URL`은 compose가 `db` 호스트로 자동 주입하므로 `.env` 값은 무시됩니다.
> `POSTGRES_USER/PASSWORD/DB`만 맞추면 됩니다.

## 3. 기동 + 마이그레이션 + 시드

```bash
docker compose up -d --build        # db + app 빌드/기동. app 컨테이너가 부팅 시 migrate deploy 자동 실행
docker compose logs -f app          # "API listening ... /v1" 확인 후 Ctrl-C

# 최초 1회만: 시드(관리자 계정 + data.js 콘텐츠 + privacy 템플릿)
docker compose exec app npm run db:seed
```

스모크 테스트:
```bash
curl -s localhost:4000/v1/health
curl -s -X POST localhost:4000/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"admin","password":"<ADMIN_DEFAULT_PASSWORD>"}'
```

## 4. Nginx (정적 프론트 + 리버스 프록시)

디자인시스템 루트 경로를 `.env`의 `STATIC_ROOT_HOST`에 지정(기본 `../aba-design-system` — `ui_kits/website/`와 `assets/`가 모두 들어있는 폴더) 후:

```bash
docker compose --profile proxy up -d nginx
```

- `/` → 정적 SPA, `/v1/` → app, `/v1/realtime/` → app(SSE, 버퍼링 off), `/uploads/` → 업로드 볼륨 직접 서빙.
- 프론트는 동일 오리진에서 `/v1/...`을 호출하므로 CORS 이슈 없음.

## 5. TLS (HTTPS)

Let's Encrypt(certbot) 권장. 도메인을 인스턴스 공인 IP로 연결한 뒤:
```bash
sudo apt install certbot
sudo certbot certonly --standalone -d aba.example.com   # 80 포트 필요(nginx 잠시 중지)
```
발급된 `fullchain.pem`/`privkey.pem`을 nginx 컨테이너에 마운트하고 `deploy/nginx.conf`에 443 `server` 블록 + `ssl_certificate` 추가, compose의 `443:443`·인증서 볼륨 주석 해제. (간편 대안: Caddy 또는 nginx-proxy + acme-companion.)

## 6. 운영

- **로그**: `docker compose logs -f app`
- **DB 백업**: `docker compose exec db pg_dump -U aba aba > backup_$(date +%F).sql`
- **업데이트**: `git pull && docker compose up -d --build app` (마이그레이션 자동 적용)
- **데이터 영속**: named volume `pgdata`(DB), `uploads`(업로드 파일). `docker compose down`은 볼륨 유지, `down -v`는 **삭제(주의)**.

---

## 7. 보안 체크리스트 (구현 반영 현황)

| 항목 | 상태 | 위치 |
|------|------|------|
| Helmet 보안 헤더 | ✅ | `main.ts` |
| CORS 화이트리스트 | ✅ (`CORS_ORIGINS`) | `main.ts` |
| 전역 ValidationPipe (whitelist+transform, 미허용 필드 차단) | ✅ | `main.ts` |
| 관리자 라우트 JWT + 역할 가드 | ✅ `@AdminOnly()` | `auth/` |
| `POST /consultations` IP당 분당 5회 제한 | ✅ `@Throttle` | `consultations.controller.ts` |
| 전역 rate limit (300/분) | ✅ Throttler | `app.module.ts` |
| privacyConsent 미동의 시 422 | ✅ `PRIVACY_CONSENT_REQUIRED` | `consultations.service.ts` |
| 업로드 mimetype 화이트리스트 + 5MB 제한 | ✅ jpg/png/webp/gif | `uploads.module.ts` |
| 업로드 이미지 1600px 리사이즈(재인코딩으로 페이로드 정화) | ✅ sharp | `uploads.service.ts` |
| Soft delete 우선 / hard delete 명시(`?hard=true`) | ✅ | `base-crud.service.ts` |
| SSE 토큰 인증 + 만료 시 401 | ✅ `?token=` | `sse-auth.guard.ts` |
| 통합 에러 envelope `{error:{code,message,fields?}}` | ✅ | `all-exceptions.filter.ts` |
| 컨테이너 비-root 실행 | ✅ `USER node` | `Dockerfile` |
| DB 외부 미개방 | ✅ (compose 포트 미게시) | `docker-compose.yml` |
| 비밀값 .env 분리 (.gitignore, 커밋 금지) | ✅ | `.env.example` |

**운영 전 필수**: `JWT_SECRET`·`POSTGRES_PASSWORD`·`ADMIN_DEFAULT_PASSWORD` 변경, `CORS_ORIGINS` 실도메인 지정, HTTPS 적용.

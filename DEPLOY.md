# 정지은 일산 ABA — 배포 가이드 (Vercel + EC2 + S3)

## 0. 아키텍처
- **프론트(정적 사이트)** → **Vercel** : `front-jungAba` (`ui_kits/website/` + `assets/`)
- **백엔드(API)** → **AWS EC2** : NestJS + PostgreSQL + Nginx(API 리버스 프록시), `docker-compose`
- **업로드 이미지** → **AWS S3** (`UPLOAD_DRIVER=s3`)
- 정적 이미지(치료사/센터장/갤러리 등)는 Vercel이 `/assets/`로 서빙, **새로 업로드되는 이미지만 S3**.

```
브라우저 ──HTTPS──> Vercel(프론트)         정적 파일 + /assets/*
        └─HTTPS──> EC2(api.도메인)/v1/*    REST + SSE  ──> Nest(app) ──> Postgres
        └─HTTPS──> S3 (또는 CloudFront)     업로드된 이미지
```

## 1. ⚠️ 가장 중요 — 백엔드는 반드시 HTTPS
Vercel 프론트는 **무조건 HTTPS**입니다. 따라서 EC2 백엔드도 **HTTPS여야** 브라우저가 API 호출을 허용합니다(HTTPS 페이지 → HTTP API는 **mixed content로 차단**). → 백엔드용 **도메인(예: `api.도메인.com`) + TLS**가 필요합니다(5번). 가장 쉬운 길은 **Cloudflare를 EC2 앞에 두는 것**(무료 HTTPS) 또는 **certbot**.

또한 백엔드의 `CORS_ORIGINS`에 **Vercel 주소**를 넣어야 교차 출처 호출(REST·SSE·업로드)이 됩니다.

---

## 2. S3 버킷 + IAM 역할
1. **버킷 생성** (리전 예: `ap-northeast-2` 서울). 이름 예: `jungeun-aba-uploads`.
2. **퍼블릭 읽기 허용**: 버킷의 "모든 퍼블릭 액세스 차단" 해제 → 버킷 정책 추가:
   ```json
   { "Version": "2012-10-17", "Statement": [
     { "Sid": "PublicRead", "Effect": "Allow", "Principal": "*",
       "Action": "s3:GetObject", "Resource": "arn:aws:s3:::jungeun-aba-uploads/*" } ] }
   ```
   (CDN/커스텀 도메인을 원하면 CloudFront를 버킷 앞에 두고, 백엔드 `.env`의 `S3_PUBLIC_BASE`에 CloudFront 도메인을 넣으세요.)
3. **EC2용 IAM 역할**(키를 서버에 두지 않음) — 정책:
   ```json
   { "Version": "2012-10-17", "Statement": [
     { "Effect": "Allow", "Action": ["s3:PutObject","s3:DeleteObject"],
       "Resource": "arn:aws:s3:::jungeun-aba-uploads/*" } ] }
   ```
   이 역할을 EC2 인스턴스에 연결(attach)하면 SDK가 자동으로 자격증명을 씁니다.

---

## 3. EC2 인스턴스
1. **Ubuntu 22.04**, **t3.micro**(프리티어 1GB) 또는 여유되면 t3.small(2GB·빌드 편함), **EBS 20~30GB**.
2. **2번의 IAM 역할 연결**(인스턴스 → 보안 → IAM 역할 수정).
3. **보안 그룹 인바운드**: 22, 80, 443 허용. (5432는 절대 열지 않음 — 컨테이너 내부에서만 접근)
4. **Elastic IP** 할당(재시작해도 IP 고정 → 도메인 연결용).
5. **스왑 2GB**(1GB 인스턴스에서 빌드 OOM 방지):
   ```bash
   sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
   sudo mkswap /swapfile && sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```
   (대안: 이미지를 GitHub Actions/로컬에서 빌드해 ECR·DockerHub에 푸시 → EC2에선 `pull`만)
6. **Docker**:
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER      # 재로그인
   ```

---

## 4. 백엔드 배포
EC2에는 **백엔드만** 있으면 됩니다(프론트는 Vercel).
```bash
git clone <백엔드_repo> backend-jungAba && cd backend-jungAba
cp .env.example .env && nano .env
```
`.env` (운영 값):
```
NODE_ENV=production
JWT_SECRET=<openssl rand -base64 48 결과>
POSTGRES_USER=aba
POSTGRES_PASSWORD=<강력한 비밀번호>
POSTGRES_DB=aba
ADMIN_DEFAULT_USERNAME=JungAba2575
ADMIN_DEFAULT_PASSWORD=JungAbaQba1329
CORS_ORIGINS=https://<your-project>.vercel.app   # 커스텀 도메인 쓰면 그것도 쉼표로 추가
# ── 업로드: S3 ──
UPLOAD_DRIVER=s3
S3_BUCKET=jungeun-aba-uploads
S3_REGION=ap-northeast-2
# S3_PUBLIC_BASE=https://cdn.도메인.com   # CloudFront 쓸 때만. 비우면 버킷 기본 URL 사용
```
기동 + 시드:
```bash
docker compose --profile proxy up -d --build     # db + app + nginx(API 프록시). app이 부팅 시 migrate 자동
docker compose exec app npm run db:seed           # 최초 1회 (관리자 + 콘텐츠 + privacy)
curl -s -o /dev/null -w '%{http_code}\n' http://localhost/v1/health   # → 200
```

---

## 5. TLS (필수) — 도메인 + HTTPS
백엔드 도메인(예: `api.도메인.com`)을 EC2 Elastic IP로 연결(A 레코드) 후, 둘 중 하나:

**(A) Cloudflare (가장 쉬움)**: 도메인을 Cloudflare에 등록 → `api` A 레코드(프록시 ON) → SSL/TLS "Flexible/Full". 브라우저↔Cloudflare는 HTTPS, Cloudflare↔EC2는 80. 인증서 설치 불필요.

**(B) certbot (EC2에서 직접)**:
```bash
sudo apt install -y certbot
sudo certbot certonly --standalone -d api.도메인.com   # 80 필요(nginx 잠깐 중지)
```
발급된 `fullchain.pem`/`privkey.pem`을 nginx 컨테이너에 마운트하고 `deploy/nginx.conf`에 443 server 블록 + `ssl_certificate` 추가, `docker-compose.yml`의 `443:443`·인증서 볼륨을 추가하세요. (대안: `nginx-proxy`+`acme-companion`, 또는 Caddy.)

---

## 6. Vercel 프론트 배포
1. `front-jungAba`를 GitHub repo로 푸시 → Vercel에서 **Import**(빌드 없음, 정적). `vercel.json`이 `/` → `/ui_kits/website/index.html` 리다이렉트.
2. **백엔드 주소 연결**: `front-jungAba/ui_kits/website/config.js` 수정 →
   ```js
   window.ABA_API_BASE = "https://api.도메인.com";   // 5번에서 만든 백엔드 HTTPS 주소
   ```
   커밋·푸시하면 Vercel이 자동 재배포.
3. 배포되면 Vercel URL을 백엔드 `.env`의 `CORS_ORIGINS`에 넣고 백엔드 재기동:
   ```bash
   docker compose --profile proxy up -d   # .env 반영
   ```

---

## 7. 검증
- `https://<vercel>/` → 사이트 표시, 콘솔 에러 없음(특히 CORS/mixed-content).
- 관리자 `https://<vercel>/ui_kits/website/admin.html` → `JungAba2575` 로그인 → 콘텐츠/상담/통계 표시.
- 상담 신청 → 관리자에 **실시간(SSE)** 으로 뜨는지.
- 관리자에서 이미지 업로드 → 반환 URL이 **S3 주소**이고 이미지가 보이는지.

## 8. 운영
- 로그: `docker compose logs -f app`
- 업데이트: `git pull && docker compose --profile proxy up -d --build app`
- DB 백업: `docker compose exec db pg_dump -U aba aba > backup_$(date +%F).sql`
- 데이터: 볼륨 `pgdata`(DB) 영속. 업로드는 S3에 보관(인스턴스와 분리).

---

## 9. 보안 체크리스트
| 항목 | 상태 | 위치 |
|------|------|------|
| Helmet 보안 헤더 | ✅ | `main.ts` |
| CORS 화이트리스트(Vercel 도메인) | ✅ `CORS_ORIGINS` | `main.ts` |
| 전역 ValidationPipe(whitelist+transform) | ✅ | `main.ts` |
| 관리자 라우트 JWT + 역할 가드 | ✅ `@AdminOnly()` | `auth/` |
| `POST /consultations` IP당 분당 5회 | ✅ `@Throttle` | `consultations.controller.ts` |
| privacyConsent 미동의 422 | ✅ | `consultations.service.ts` |
| 상담 멱등성(Idempotency-Key) | ✅ | `consultations.service.ts` |
| 업로드 mimetype 화이트리스트 + 5MB + 1600px 재인코딩 | ✅ | `uploads.*` |
| 업로드 저장 S3(자격증명=IAM 인스턴스 역할, 키 미보관) | ✅ | `s3-storage.service.ts` |
| SSE 토큰 인증 + 만료 401 + Last-Event-ID 복구 | ✅ | `realtime/` |
| 통합 에러 envelope | ✅ | `all-exceptions.filter.ts` |
| 컨테이너 비-root | ✅ `USER node` | `Dockerfile` |
| DB 외부 미개방 | ✅ | `docker-compose.yml` |
| 백엔드 HTTPS(mixed-content 방지) | ⚠️ 배포 시 필수 | 5번 |
| 비밀값 .env 분리(커밋 금지) | ✅ | `.env.example` |

**운영 전 필수**: `JWT_SECRET`·`POSTGRES_PASSWORD` 강력하게, `CORS_ORIGINS`=Vercel 주소, **백엔드 HTTPS**, `config.js`의 `ABA_API_BASE`=백엔드 HTTPS 주소, S3 버킷 정책·IAM 역할.

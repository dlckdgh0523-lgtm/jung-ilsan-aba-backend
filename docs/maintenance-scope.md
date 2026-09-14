# 유지보수 범위 문서 (정지은일산ABA 홈페이지)

작성: 2026-09-15. 무상으로 계속 돕더라도 **범위는 이 문서가 기준**이다.

## 1. 월 고정비 (2026-09 기준 — 금액은 각 대시보드에서 확인)

| 항목 | 서비스 | 비고 |
|---|---|---|
| API 서버 + DB | Render (웹 서비스 상시가동 + PostgreSQL) | 유료 플랜 — 금액은 Render 대시보드 Billing에서 확인 |
| 프론트 호스팅 | Vercel | 현재 Hobby(무료) 범위 |
| 도메인 | chungaba.com 등록기관 | 연 단위 갱신비 — 등록기관 계정에서 확인 |
| 알림톡 | 솔라피 | 사용 시 건당 과금(약 13원/건), 미설정 시 0원 |
| LLM (AI 제목/GEO 검수/측정) | Anthropic API | 사용량 과금. Haiku 기준 저비용. ANTHROPIC_API_KEY 설정 시에만 발생 |

## 2. 정기 운영 작업 (무상 유지 범위)

- 블로그 동기화 모니터링: 실패 시 관리자 화면 상태 확인, 재실행
- 배포 상태 확인: CI(GitHub Actions) 실패 시 원인 파악·수정
- SSR 헬스체크(하루 2회 자동) 실패 알림 대응
- 관리자 계정 비밀번호 재설정 지원 (Render Shell 스크립트)
- 보안 패치 수준의 의존성 업데이트 (버전 고정 정책 유지: sanitize-html 2.13.1, @nestjs/schedule 5.0.1)
- GEO 재측정 (4주 주기, `npm run geo:measure`) 및 결과 공유
- 콘텐츠 입력 방법 안내 (관리자 페이지 사용법 질문 응대)

## 3. "추가 개발"로 분류되는 것 (별도 협의)

- 새 페이지/새 메뉴/새 기능 (예: 예약 시스템, 결제, 회원제, 치료사별 페이지)
- 디자인 리뉴얼, 반응형 재작업
- 외부 서비스 신규 연동 (인스타그램, 카카오 로그인, 새 알림 채널 등)
- 대량 콘텐츠 입력 대행, 원고 작성 대행
- 외부 플랫폼(네이버 플레이스, GBP, FindABA) 등록·운영 — **운영자(센터) 담당**, 방법 안내까지가 무상 범위
- 검색 순위/AI 노출 보장 — 불가능한 약속이므로 범위에 없음 (측정과 사실 기반 개선만 제공)

## 4. 인수인계 시 필요한 계정/권한

| 계정 | 용도 | 현재 관리 |
|---|---|---|
| GitHub (dlckdgh0523-lgtm) — backend/front 레포 | 코드, CI, 헬스체크 | 개발 담당 |
| Render | API 서버·DB·환경변수·Shell | 개발 담당 |
| Vercel | 프론트 배포, 도메인 연결 | 개발 담당 |
| 도메인 등록기관 (chungaba.com) | 도메인 갱신, DNS | 확인 필요 |
| Google Search Console | 색인·사이트맵 | 소유확인 파일 업로드됨 (구글 계정) |
| 네이버 서치어드바이저 | 색인·사이트맵·RSS | 소유확인 파일 업로드됨 (네이버 계정) |
| 관리자 페이지 (jungaba-admin) | 콘텐츠 관리 | 센터 |
| 솔라피 (설정 시) | 알림톡 | 센터 |
| Anthropic Console (설정 시) | API 키 발급·사용량 | 개발 담당 → 키는 Render 환경변수로만 |

### 환경변수 목록 (Render — 값은 절대 문서·커밋에 남기지 않음)

`DATABASE_URL`, `JWT_SECRET`, `ADMIN_DEFAULT_USERNAME`, `FRONT_BASE_URL`, `API_PUBLIC_BASE`,
`BLOG_SYNC_*`, `REVIEW_TOKEN_SECRET`, `ALIMTALK_*`(선택), `LLM_ENABLED`/`LLM_API_KEY` 또는
`ANTHROPIC_API_KEY`(선택), `GEO_REVIEW_ENABLED`(선택), `GEO_MEASURE_MODEL`(선택)

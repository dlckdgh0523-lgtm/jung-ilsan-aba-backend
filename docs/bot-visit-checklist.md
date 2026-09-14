# AI 크롤러 방문 추적 — 배포 1주일 후 체크리스트

배포일: 2026-09-15. **1주일 뒤(2026-09-22 이후)** 아래를 확인한다.

## 확인 방법

관리자 페이지 → **AI 크롤러** 메뉴 (또는 API: `GET /v1/admin/bot-visits?days=7`, 관리자 토큰 필요)

## 체크리스트

- [ ] **Googlebot 방문이 있는가?** — 서치콘솔 등록했으므로 반드시 있어야 정상. 없으면: GSC 색인 상태·sitemap 처리 상태 확인.
- [ ] **Yeti(네이버) 방문이 있는가?** — 서치어드바이저 등록했으므로 있어야 정상. 없으면: 웹마스터도구 수집 현황 확인, robots.txt 재확인.
- [ ] **GPTBot / OAI-SearchBot 방문이 있는가?** — 없어도 초기엔 정상(신규 도메인). 4주 후에도 0이면 사이트 인지도(외부 링크) 문제.
- [ ] **ClaudeBot / PerplexityBot 방문이 있는가?** — 위와 동일 기준.
- [ ] **어떤 경로를 읽어가는가?** — /sitemap.xml, /blog/*, /about, /team이 나오면 SSR 구조가 의도대로 작동 중. `/v1/...` API 경로만 나온다면 프록시 경유가 아니라 API 원본을 긁는 것(문제 아님 — API 원본 robots.txt는 차단이므로 무시됨을 확인).
- [ ] **Bytespider 등 원치 않는 봇 트래픽이 과도한가?** — 과도하면 robots.txt 차단 검토(추가 개발).

## 참고

- 기록되는 것: 봇 이름, User-Agent, 요청 경로, IP, 시각. 일반 방문자는 기록하지 않는다.
- 봇 목록: GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-Web, Claude-User, PerplexityBot, Perplexity-User, Google-Extended, Googlebot, Bingbot, Yeti, Amazonbot, CCBot, Bytespider (src/bot-visits/bot-match.ts)
- 주의: 이 수치는 **API 서버(jungaba-api.onrender.com)에 도달한 요청**만 잡는다. Vercel이 직접 서빙하는 정적 리소스(홈 index.html, 이미지)는 여기 안 잡힌다 — 홈 방문은 Vercel 대시보드에서 봐야 한다. SSR 페이지(/about, /team, /blog 등)와 sitemap/rss는 전부 잡힌다.

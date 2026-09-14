# 블로그 동기화 — 관리자페이지(프론트, 별도 레포) TODO

백엔드(2026-09, `src/blog-sync/`)가 네이버 블로그 글을 **홈페이지 블로그 게시글(Article)의
초안(draft)** 으로 자동 생성한다. 관리자페이지에서 아래를 붙이면
"블로그에 글 올림 → 관리자페이지 알림 → 검수/수정 → 발행" 플로우가 완성된다.
모든 API는 admin JWT 필요.

## 1. 블로그 글 관리 화면: 초안 검수·수정·발행

- 초안 목록: `GET /v1/articles?status=draft` (관리자는 `status=draft|published|all` 필터 가능)
- Article 응답에 블로그 출처 필드가 있다 (기존 필드는 그대로):
  - `sourceUrl: string | null` — 네이버 원문 URL. **null이 아니면 블로그에서 가져온 글**
  - `sourceId: string | null` — 네이버 logNo
  - `syncedAt: string | null` — 가져온 시각(ISO)
- `sourceUrl`이 있으면 목록 행에 "네이버" 배지 + 원문 새 탭 링크.
- 가져온 글의 `publishedAt`에는 **네이버 원문 작성일**이 미리 들어 있다 —
  발행해도 이 날짜가 유지돼 목록이 실제 작성일 순으로 정렬된다.
- 센터장 수정: 기존 게시글 편집 화면 그대로 사용 (`PUT/PATCH /v1/articles/:id`).
  제목·본문(content, HTML)·카테고리·태그·썸네일 모두 수정 가능.
- **발행**: `PATCH /v1/articles/:id` body `{ "status": "published" }`.
  삭제는 기존 `DELETE /v1/articles/:id` — 삭제한 글은 다시 가져오지 않는다(안내 문구 권장).
- 카테고리는 네이버 카테고리명(공지/부모교육/센터소식 등)으로 자동 생성·매핑돼 있다.

## 2. "지금 동기화" 버튼

- `POST /v1/blog-sync/run` (body 없음) → 200:
  ```json
  {
    "runId": "…",
    "status": "ok",
    "fetched": 50,
    "created": 2,
    "skipped": 47,
    "deferred": 1,
    "failures": ["2243…: 메시지"],
    "createdTitles": ["글 제목 …"]
  }
  ```
- 409 (`code: "BLOG_SYNC_IN_PROGRESS"`) = 이미 실행 중 → 토스트로 안내.
- 400 (`code: "BLOG_SYNC_NOT_CONFIGURED"`) = `NAVER_BLOG_ID` 미설정.
- 실행이 수십 초 걸릴 수 있음(글당 이미지 수십 장 미러링) → 버튼 로딩 상태 필수.

## 3. 마지막 동기화 상태 표시

- `GET /v1/blog-sync/status` →
  ```json
  {
    "enabled": true,
    "blogId": "ilsanaba",
    "cron": "*/30 * * * *",
    "categories": [],
    "maxPerRun": 5,
    "since": "2026-08-01",
    "running": false,
    "lastRun": { "startedAt": "…", "finishedAt": "…", "status": "ok", "fetched": 50, "created": 2, "skipped": 48, "error": null },
    "recentRuns": [ /* 최근 10회, 같은 shape */ ]
  }
  ```
- 블로그 관리 화면 상단에 "마지막 동기화: n분 전 · 새 초안 2건" 정도로 요약 표시.
  `lastRun.status === "error"` 또는 `lastRun.error`가 있으면 경고색으로.

## 4. 관리자페이지 알림 (SSE `blog.synced`)

- 기존 관리자 SSE 스트림(`GET /v1/realtime/consultations`)에 **named event**로 흘러온다.
  기존 `consultation` 리스너는 영향 없음.
  ```js
  eventSource.addEventListener('blog.synced', (e) => {
    const { created, articles } = JSON.parse(e.data);
    // articles: [{ id, title, slug, sourceUrl }]
    toast(`블로그에서 새 글 ${created}건을 가져왔습니다. 검수 후 발행해 주세요.`);
  });
  ```
- 토스트 클릭 시 블로그 글 관리(초안 필터) 화면으로 이동 권장.
- 관리자페이지가 열려 있지 않을 때 온 글은 다음 접속 시 3번의 상태 표시/초안 개수로 확인.

## 5. 관리자 "비밀번호 변경" 폼 (블로그 동기화와 무관하지만 같은 관리자페이지 작업)

- 입력 3개: **현재 비밀번호 / 새 비밀번호 / 새 비밀번호 확인** (확인 불일치는 프론트에서 차단)
- 새 비밀번호 규칙(프론트에서도 미리 안내): **10자 이상, 영문+숫자 포함**
- 호출:
  ```
  PATCH /v1/auth/password        (Authorization: Bearer <토큰>, 분당 5회 제한)
  Body: { "currentPassword": "...", "newPassword": "..." }
  ```
- 응답 처리:
  - **200 `{ token }`** → 다른 기기 세션은 전부 로그아웃됨. **반환된 토큰으로
    `sessionStorage`의 `aba-token`을 교체**해야 현재 브라우저의 로그인이 유지된다.
    ```js
    const { token } = await res.json();
    sessionStorage.setItem('aba-token', token);
    toast('비밀번호를 변경했습니다. 다른 기기에서는 다시 로그인해야 합니다.');
    ```
  - 401 `INVALID_CREDENTIALS` → "현재 비밀번호가 올바르지 않습니다."
  - 422 `WEAK_PASSWORD` → 규칙 안내 표시
  - 422 `PASSWORD_UNCHANGED` → "현재 비밀번호와 다른 비밀번호를 사용해 주세요."
  - 429 → "잠시 후 다시 시도해 주세요." (분당 5회 제한)

## 6. (선택) 파서 미리보기 디버그 화면

- `POST /v1/blog-sync/preview` `{ "url": "https://blog.naver.com/ilsanaba/…" }`
  → `{ title, body, images: string[], dropped: string[] }`
- 저장하지 않고 파싱 결과만 보여준다. 네이버 마크업 변경 의심 시 확인용.
  `dropped`는 변환에서 버려진 모듈 종류(동영상/스티커 등).

## 참고: 이행(마이그레이션) 메모

- 2026-09-14 이전에 공지(Notice)로 들어간 블로그 글 2건은 그대로 남아 있고,
  같은 글이 블로그 초안으로 다시 들어온다. 블로그 메뉴로 옮기려면 **공지 버전을
  삭제(또는 비공개)** 하고 블로그 초안을 발행하면 된다. 둘 다 공개하면 중복 노출됨.

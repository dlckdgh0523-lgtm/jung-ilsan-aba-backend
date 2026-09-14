# 블로그 동기화 — 관리자페이지(프론트, 별도 레포) TODO

백엔드(2026-09, `src/blog-sync/`)가 네이버 블로그 글을 비공개 공지로 자동 생성한다.
관리자페이지에서 아래를 붙이면 반자동 플로우가 완성된다. 모든 API는 admin JWT 필요.

## 1. 공지 목록: "블로그" 배지 + 원문 링크

- `GET /v1/notices` 응답의 Notice에 필드 추가됨 (기존 필드는 그대로):
  - `sourceUrl: string | null` — 블로그 원문 URL. **null이 아니면 블로그에서 가져온 공지**
  - `sourceId: string | null` — 네이버 logNo
  - `syncedAt: string | null` — 가져온 시각(ISO)
- `sourceUrl`이 있으면 목록 행에 "블로그" 배지를 달고, 배지(또는 별도 아이콘)를
  원문 새 탭 링크로 연결한다.
- 가져온 글은 `visible=false`로 생성되므로 **비공개 필터에서 보인다**. 검수 후
  기존 공개 토글(`PATCH /v1/notices/:id/visibility`)로 공개하면 끝 — 새 API 불필요.
- 주의: 블로그 공지를 삭제하면 다시 가져오지 않는다(의도된 동작). 안내 문구 권장.

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
    "since": "2026-09-15" ,
    "running": false,
    "lastRun": { "startedAt": "…", "finishedAt": "…", "status": "ok", "fetched": 50, "created": 2, "skipped": 48, "error": null },
    "recentRuns": [ /* 최근 10회, 같은 shape */ ]
  }
  ```
- 공지 관리 화면 상단에 "마지막 동기화: n분 전 · 생성 2건" 정도로 요약 표시.
  `lastRun.status === "error"` 또는 `lastRun.error`가 있으면 경고색으로.

## 4. SSE 토스트 (`notice.synced`)

- 기존 관리자 SSE 스트림(`GET /v1/realtime/consultations`)에 **named event**로 흘러온다.
  기존 `consultation` 리스너는 영향 없음.
  ```js
  eventSource.addEventListener('notice.synced', (e) => {
    const { created, notices } = JSON.parse(e.data);
    // notices: [{ id, title, sourceUrl }]
    toast(`블로그에서 새 공지 ${created}건을 가져왔습니다. 검수 후 공개해 주세요.`);
  });
  ```
- 토스트 클릭 시 공지 관리(비공개 필터) 화면으로 이동 권장.

## 5. 관리자 "비밀번호 변경" 폼 (2026-09 추가, 블로그 동기화와 무관하지만 같은 관리자페이지 작업)

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

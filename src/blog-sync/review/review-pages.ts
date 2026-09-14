import type { Article } from '@prisma/client';
import { normalizeNoticeHtml } from '../html-normalizer';

/**
 * Server-rendered mobile-first review pages. Deliberately spartan: inline CSS
 * only, no external scripts/fonts/tracking (the link lands in KakaoTalk's
 * in-app browser on the director's phone).
 */

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const kst = (d: Date): string =>
  new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Seoul',
  }).format(d);

function shell(title: string, body: string): string {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #FBF8F3; color: #1C1A17; font-family: -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; }
  .wrap { max-width: 640px; margin: 0 auto; padding: 20px 16px 48px; }
  .card { background: #fff; border: 1px solid #EAE3D6; border-radius: 16px; padding: 20px; }
  .brand { font-size: 13px; font-weight: 700; color: #EC8A1F; margin-bottom: 12px; }
  h1 { font-size: 20px; line-height: 1.4; margin: 0 0 6px; }
  .src { font-size: 12.5px; color: #807B72; margin: 0 0 4px; word-break: break-all; }
  .meta { font-size: 13px; color: #4A4640; margin: 0 0 16px; }
  .summary { font-size: 14px; background: #F4EFE6; border-radius: 10px; padding: 12px 14px; margin: 0 0 16px; line-height: 1.6; }
  .preview { border-top: 1px solid #EAE3D6; padding-top: 16px; font-size: 15px; line-height: 1.75; overflow-wrap: break-word; }
  .preview img { max-width: 100%; height: auto; border-radius: 10px; }
  .preview blockquote { margin: 0; padding: 8px 14px; border-left: 3px solid #F8AD46; color: #4A4640; }
  .actions { position: sticky; bottom: 0; background: linear-gradient(#FBF8F300, #FBF8F3 30%); padding: 16px 0 0; margin-top: 20px; }
  .btn { display: block; width: 100%; border: 0; border-radius: 12px; padding: 15px; font-size: 16px; font-weight: 700; cursor: pointer; }
  .btn-publish { background: #7DBE32; color: #fff; margin-bottom: 8px; }
  .btn-hold { background: #fff; color: #4A4640; border: 1px solid #D8D0C0; }
  .check { display: flex; gap: 8px; align-items: flex-start; font-size: 13.5px; color: #4A4640; margin: 0 0 12px; }
  .check input { margin-top: 2px; }
  .origin { display: block; text-align: center; margin-top: 18px; font-size: 13px; color: #807B72; }
  .state { text-align: center; padding: 36px 12px; }
  .state h1 { font-size: 18px; }
  .state p { font-size: 14px; color: #4A4640; line-height: 1.7; }
</style>
</head>
<body><div class="wrap">${body}</div></body>
</html>`;
}

export function renderReviewForm(
  article: Article,
  summary: string | null,
  expiresAt: Date,
): string {
  const preview = normalizeNoticeHtml(article.content ?? '');
  return shell(
    '홈페이지 게시 확인',
    `<div class="card">
  <div class="brand">정지은 일산 ABA · 홈페이지 게시 확인</div>
  <h1>${esc(article.title)}</h1>
  ${article.sourceTitle && article.sourceTitle !== article.title ? `<p class="src">블로그 원제목: ${esc(article.sourceTitle)}</p>` : ''}
  <p class="meta">게시일 ${article.publishedAt ? kst(article.publishedAt) : '-'} · 링크 유효기간 ${kst(expiresAt)}까지</p>
  ${summary ? `<p class="summary">${esc(summary)}</p>` : ''}
  <div class="preview">${preview}</div>
</div>
<form method="post" class="actions">
  <label class="check">
    <input type="checkbox" name="useSourceTitle" value="on">
    <span>블로그 원래 제목 그대로 공개하기</span>
  </label>
  <button class="btn btn-publish" type="submit" name="action" value="publish">홈페이지에 공개</button>
  <button class="btn btn-hold" type="submit" name="action" value="hold">보류 (나중에 결정)</button>
</form>
${article.sourceUrl ? `<a class="origin" href="${esc(article.sourceUrl)}" rel="noopener noreferrer">네이버 원문 보기 →</a>` : ''}`,
  );
}

export function renderDecided(article: Article, decision: string, decidedAt: Date | null): string {
  const what = decision === 'publish' ? '홈페이지에 공개되었습니다' : '보류로 처리되었습니다';
  return shell(
    '처리 완료',
    `<div class="card state">
  <h1>✔ 이미 처리된 링크입니다</h1>
  <p>「${esc(article.title)}」<br>${decidedAt ? kst(decidedAt) + '에 ' : ''}${what}.<br>변경이 필요하면 관리자페이지에서 처리해 주세요.</p>
</div>`,
  );
}

export function renderHandledElsewhere(article: Article): string {
  const what = article.deletedAt ? '삭제' : '공개';
  return shell(
    '처리 완료',
    `<div class="card state">
  <h1>이미 관리자페이지에서 처리됨</h1>
  <p>「${esc(article.title)}」은(는) 이미 관리자페이지에서 ${what} 처리되었습니다.<br>이 링크로는 더 이상 변경할 수 없습니다.</p>
</div>`,
  );
}

export function renderExpired(): string {
  return shell(
    '링크 만료',
    `<div class="card state">
  <h1>링크가 만료되었습니다</h1>
  <p>보안을 위해 확인 링크는 일정 기간만 유효합니다.<br>관리자페이지에서 처리하거나, 알림 재전송을 요청해 주세요.</p>
</div>`,
  );
}

/** Invalid token — same wording regardless of why, to avoid probing. */
export function renderNotFound(): string {
  return shell(
    '페이지를 찾을 수 없습니다',
    `<div class="card state">
  <h1>페이지를 찾을 수 없습니다</h1>
  <p>링크가 올바르지 않거나 더 이상 유효하지 않습니다.</p>
</div>`,
  );
}

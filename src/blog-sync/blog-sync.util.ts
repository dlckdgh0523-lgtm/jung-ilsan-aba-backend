/** URL/date helpers for the Naver blog sync — pure functions, unit-tested. */

/** Canonical post URL used as the notice dedupe key. */
export function canonicalPostUrl(blogId: string, logNo: string): string {
  return `https://blog.naver.com/${blogId}/${logNo}`;
}

/** Mobile page — the only reliable public source of the full post body. */
export function mobilePostUrl(blogId: string, logNo: string): string {
  return `https://m.blog.naver.com/PostView.naver?blogId=${encodeURIComponent(blogId)}&logNo=${encodeURIComponent(logNo)}`;
}

/**
 * Extract blogId/logNo from any Naver post URL shape:
 * `blog.naver.com/{id}/{logNo}`, `m.blog.naver.com/{id}/{logNo}`,
 * `…/PostView.naver?blogId={id}&logNo={logNo}` (query order-insensitive).
 * Returns null for non-Naver-blog hosts — the preview endpoint refuses those.
 */
export function parseNaverPostUrl(raw: string): { blogId: string; logNo: string } | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!['blog.naver.com', 'm.blog.naver.com'].includes(url.hostname)) return null;

  const qBlogId = url.searchParams.get('blogId');
  const qLogNo = url.searchParams.get('logNo');
  if (qBlogId && qLogNo && /^\d+$/.test(qLogNo)) return { blogId: qBlogId, logNo: qLogNo };

  const m = url.pathname.match(/^\/([A-Za-z0-9_-]+)\/(\d{6,})\/?$/);
  if (m) return { blogId: m[1], logNo: m[2] };
  return null;
}

/** RFC-822 pubDate → the notices' display format ("YYYY.MM.DD", Asia/Seoul). */
export function toKstDisplayDate(date: Date): string {
  // en-CA gives ISO-like YYYY-MM-DD regardless of server locale.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(date)
    .replaceAll('-', '.');
}

const BLOCK_CLOSERS = /<\/(p|blockquote|ul|ol|h2|h3|h4)>/gi;

/**
 * Cap the body at `max` chars without cutting through a tag: keep whole
 * block elements up to the limit and note the truncation. The appended
 * source link (added by the sync) still points readers at the full post.
 */
export function truncateHtmlBlocks(
  html: string,
  max: number,
): { html: string; truncated: boolean } {
  if (html.length <= max) return { html, truncated: false };
  let end = 0;
  for (const m of html.matchAll(BLOCK_CLOSERS)) {
    const closeEnd = (m.index ?? 0) + m[0].length;
    if (closeEnd > max) break;
    end = closeEnd;
  }
  return { html: `${html.slice(0, end)}<p>… (이하 생략)</p>`, truncated: true };
}

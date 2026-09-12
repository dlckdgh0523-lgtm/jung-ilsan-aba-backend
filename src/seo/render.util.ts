/** Shared helpers for the server-rendered SEO pages (blog/tag pages + sitemap). */

export function escapeHtml(s: unknown): string {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}

export function escapeXml(s: unknown): string {
  return escapeHtml(s);
}

/**
 * Defensive sanitize of admin-authored rich HTML for server-side rendering.
 * Mirrors the SPA's sanitizeNoticeHtml: drop active content and JS URLs,
 * keep formatting (inline styles carry Quill sizes/colors and image widths).
 */
export function sanitizeRichHtml(html: string): string {
  return String(html || '')
    .replace(
      /<(script|style|iframe|object|embed|link|meta|form|input)\b[\s\S]*?(<\/\1>|\/?>)/gi,
      '',
    )
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(href|src)\s*=\s*(["']?)\s*javascript:[^"'>\s]*\2/gi, '');
}

/** Wraps page content in the brand-styled minimal document used by all SEO pages. */
export function seoPageShell(opts: {
  title: string;
  description: string;
  canonical: string;
  frontBase: string;
  robots?: string;
  ogImage?: string;
  jsonLd?: object[];
  bodyHtml: string;
}): string {
  const { title, description, canonical, frontBase, robots, ogImage, jsonLd, bodyHtml } = opts;
  return `<!doctype html><html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(canonical)}">
${robots ? `<meta name="robots" content="${escapeHtml(robots)}">` : ''}
<meta property="og:type" content="article"><meta property="og:site_name" content="정지은일산ABA">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(canonical)}">
${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
${(jsonLd || []).map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n')}
<style>
:root{--orange:#F8AD46;--green:#7DBE32;--green-deep:#5BA31E;--bg:#FBF8F3;--ink:#1C1A17;--fg2:#4A453D;--fg3:#8A8378;--border:#EAE4D8}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg2);font:16px/1.75 "Pretendard Variable",Pretendard,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}
.wrap{max-width:760px;margin:0 auto;padding:0 20px}
header.site{background:#fff;border-bottom:1px solid var(--border)}
header.site .wrap{display:flex;align-items:center;justify-content:space-between;padding:14px 20px}
header.site a.brand{font-weight:800;color:var(--ink);text-decoration:none;font-size:17px}
header.site a.cta{background:linear-gradient(95deg,var(--orange),var(--green));color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:9px 16px;border-radius:999px}
main{padding:40px 0 56px}
h1{color:var(--ink);font-size:30px;line-height:1.35;margin:8px 0 12px}
.meta{color:var(--fg3);font-size:14px;margin-bottom:24px}
.meta a{color:var(--green-deep);text-decoration:none}
article img{max-width:100%;height:auto;border-radius:12px}
article h2{color:var(--ink);font-size:22px;margin-top:36px}
article h3{color:var(--ink);font-size:18px}
article a{color:var(--green-deep)}
.tags{display:flex;flex-wrap:wrap;gap:8px;margin:28px 0}
.tags a{background:#fff;border:1px solid var(--border);border-radius:999px;padding:6px 14px;font-size:13px;color:var(--fg2);text-decoration:none}
.cards{display:grid;gap:12px;margin:16px 0;padding:0;list-style:none}
.cards li{background:#fff;border:1px solid var(--border);border-radius:14px;padding:16px 18px}
.cards a{color:var(--ink);font-weight:700;text-decoration:none}
.cards p{margin:6px 0 0;font-size:14px;color:var(--fg3)}
.section-h{color:var(--ink);font-size:19px;margin:40px 0 8px;font-weight:800}
.faq{background:#fff;border:1px solid var(--border);border-radius:14px;padding:4px 18px;margin:12px 0}
.faq h3{font-size:16px;color:var(--ink);margin:14px 0 4px}
.faq p{margin:0 0 14px}
.cta-box{margin:44px 0 0;background:#fff;border:1px solid var(--border);border-radius:16px;padding:24px;text-align:center}
.cta-box a{display:inline-block;background:linear-gradient(95deg,var(--orange),var(--green));color:#fff;text-decoration:none;font-weight:700;padding:12px 26px;border-radius:999px;margin-top:10px}
footer.site{border-top:1px solid var(--border);padding:28px 0 40px;font-size:13px;color:var(--fg3)}
footer.site .wrap p{margin:4px 0}
</style></head><body>
<header class="site"><div class="wrap">
<a class="brand" href="${escapeHtml(frontBase)}/">정지은일산ABA</a>
<a class="cta" href="${escapeHtml(frontBase)}/#contact">상담 신청</a>
</div></header>
<main><div class="wrap">
${bodyHtml}
</div></main>
<footer class="site"><div class="wrap">
<p><strong>정지은일산ABA</strong> — 일산 ABA 행동발달센터 · 응용행동분석</p>
<p>경기도 고양시 일산서구 주엽로 150 자유프라자 606호 · 031-977-2575 · 평일 09:00–21:00</p>
<p><a href="${escapeHtml(frontBase)}/" style="color:inherit">공식 홈페이지</a> · <a href="https://blog.naver.com/ilsanaba" style="color:inherit">네이버 블로그</a></p>
</div></footer>
</body></html>`;
}

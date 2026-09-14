/**
 * Shared types for the Naver blog → notice sync pipeline.
 * All network access goes through the injected FETCH token so tests can mock it
 * and no unit test ever talks to Naver.
 */

/** DI token for the fetch implementation (global fetch in production, a stub in tests). */
export const BLOG_FETCH = Symbol('BLOG_FETCH');

export type FetchLike = typeof fetch;

/** One RSS entry, already reduced to what the sync needs. */
export interface BlogRssItem {
  logNo: string;
  /** Canonical post URL (`https://blog.naver.com/{blogId}/{logNo}`) — the dedupe key. */
  url: string;
  title: string;
  category: string;
  publishedAt: Date;
}

/** Parsed post body, before image mirroring and sanitisation. */
export interface ParsedPost {
  /** og:title — used by the preview endpoint (sync uses the RSS title). */
  title: string;
  /** Block-level HTML: <p>/<blockquote>/<img>/<a> sequence with original Naver image URLs. */
  bodyHtml: string;
  /** Original (un-mirrored) image URLs, in document order. */
  imageUrls: string[];
  /** Module types that were dropped (video/sticker/map/file/…) — surfaced in preview. */
  dropped: string[];
  /**
   * Set by the LLM transformer: keyword-stuffed blog title → clean homepage
   * title (≤25 chars). Absent on passthrough — the sync then keeps the RSS title.
   */
  cleanTitle?: string;
  /** LLM 1-2 sentence summary (≤80 chars) for the review alimtalk. */
  summary?: string;
  /**
   * LLM's pick among the site's EXISTING blog categories (validated against
   * the provided list). Absent → the sync maps the Naver category name as before.
   */
  categoryName?: string;
}

/** Extra inputs a transformer may use (all optional — passthrough ignores it). */
export interface TransformContext {
  /** Names of the site's visible blog categories, for LLM categorisation. */
  categories: string[];
}

/** DI token for the post transformer hook. */
export const POST_TRANSFORMER = Symbol('POST_TRANSFORMER');

/**
 * Extension seam between parsing and persistence (e.g. future rewriting).
 * v1 ships only the passthrough implementation — no LLM, no content changes.
 */
export interface PostTransformer {
  transform(
    post: ParsedPost,
    item: BlogRssItem,
    context?: TransformContext,
  ): Promise<ParsedPost> | ParsedPost;
}

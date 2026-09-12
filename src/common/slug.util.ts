/**
 * URL slug from a free-form (usually Korean) title.
 * Keeps Hangul — encoded Korean slugs are valid URLs and read naturally in search;
 * admins can always overwrite with a hand-written romanized slug.
 */
export function slugify(input: string): string {
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/[\s_·|/]+/g, '-')
    .replace(/[^a-z0-9가-힣ㄱ-ㅎㅏ-ㅣ-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

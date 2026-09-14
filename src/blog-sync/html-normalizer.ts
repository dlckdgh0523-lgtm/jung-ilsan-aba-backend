import sanitizeHtml from 'sanitize-html';

/**
 * Server-side sanitisation of imported blog HTML. The frontend's
 * sanitizeNoticeHtml filters again on render, but never rely on it alone —
 * this is the copy that lands in the DB.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    'h2',
    'h3',
    'h4',
    'ul',
    'ol',
    'li',
    'a',
    'img',
    'blockquote',
  ],
  allowedAttributes: { a: ['href', 'target', 'rel'], img: ['src', 'alt'] },
  // http(s) plus relative URLs (mirrored images are served from /uploads on local driver).
  allowedSchemes: ['http', 'https'],
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' },
    }),
  },
};

/**
 * <p> containing only whitespace/&nbsp;/<br> — SmartEditor emits runs of these
 * as spacing, using zero-width spaces (U+200B/U+FEFF) as the "blank" content.
 */
const EMPTY_P = '<p>(?:\\s|\\u200B|\\uFEFF|&nbsp;|&#160;|<br\\s*/?>)*</p>';

export function normalizeNoticeHtml(html: string): string {
  const clean = sanitizeHtml(html, OPTIONS);
  return (
    clean
      // collapse consecutive empty paragraphs into a single blank line …
      .replace(new RegExp(`(?:${EMPTY_P}\\s*){2,}`, 'gi'), '<p><br /></p>\n')
      // … and drop leading/trailing ones entirely
      .replace(new RegExp(`^(?:\\s*${EMPTY_P})+`, 'i'), '')
      .replace(new RegExp(`(?:${EMPTY_P}\\s*)+$`, 'i'), '')
      .trim()
  );
}

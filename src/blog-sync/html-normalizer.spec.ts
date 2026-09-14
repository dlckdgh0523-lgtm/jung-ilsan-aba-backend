import { normalizeNoticeHtml } from './html-normalizer';

describe('normalizeNoticeHtml', () => {
  it('strips disallowed tags but keeps their text', () => {
    expect(normalizeNoticeHtml('<p><span class="se-fs-fs24"><b>제목</b> 본문</span></p>')).toBe(
      '<p><b>제목</b> 본문</p>',
    );
  });

  it('removes script/style entirely', () => {
    expect(normalizeNoticeHtml('<p>안전</p><script>alert(1)</script>')).toBe('<p>안전</p>');
  });

  it('drops class/style/data-* attributes', () => {
    const out = normalizeNoticeHtml(
      '<p class="x" style="color:red" data-id="1"><img src="https://a/b.png" alt="c" data-lazy-src="x" width="5"></p>',
    );
    expect(out).toBe('<p><img src="https://a/b.png" alt="c" /></p>');
  });

  it('forces target=_blank rel=noopener on links and blocks javascript: URLs', () => {
    expect(normalizeNoticeHtml('<a href="https://example.com">x</a>')).toBe(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">x</a>',
    );
    expect(normalizeNoticeHtml('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript:');
  });

  it('collapses runs of empty paragraphs to a single blank line', () => {
    const out = normalizeNoticeHtml('<p>위</p><p>&nbsp;</p><p></p><p><br></p><p>아래</p>');
    expect(out).toBe('<p>위</p><p><br /></p>\n<p>아래</p>');
  });

  it('treats zero-width-space paragraphs (SmartEditor blank lines) as empty', () => {
    const out = normalizeNoticeHtml('<p>위</p><p>​</p><p>​</p><p>아래</p>');
    expect(out).toBe('<p>위</p><p><br /></p>\n<p>아래</p>');
  });

  it('trims leading and trailing empty paragraphs', () => {
    expect(normalizeNoticeHtml('<p></p><p>본문</p><p>&nbsp;</p>')).toBe('<p>본문</p>');
  });

  it('keeps relative image URLs (locally mirrored /uploads paths)', () => {
    expect(normalizeNoticeHtml('<img src="/uploads/abc.png">')).toBe(
      '<img src="/uploads/abc.png" />',
    );
  });
});

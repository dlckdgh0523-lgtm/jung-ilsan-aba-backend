import { sanitizeRichHtml, escapeHtml } from './render.util';

describe('sanitizeRichHtml', () => {
  it('drops script tags but keeps formatting and image width styles', () => {
    const html =
      '<p style="font-size:18px">안녕<script>alert(1)</script></p>' +
      '<img src="/uploads/a.png" style="width:60%">';
    const out = sanitizeRichHtml(html);
    expect(out).not.toContain('<script');
    expect(out).toContain('style="font-size:18px"');
    expect(out).toContain('style="width:60%"');
  });

  it('strips inline event handlers and javascript: URLs', () => {
    const out = sanitizeRichHtml('<a href="javascript:evil()" onclick="x()">link</a>');
    expect(out).not.toContain('javascript:');
    expect(out).not.toContain('onclick');
  });
});

describe('escapeHtml', () => {
  it('escapes html-significant characters', () => {
    expect(escapeHtml('<b>&"\'')).toBe('&lt;b&gt;&amp;&quot;&#39;');
  });
});

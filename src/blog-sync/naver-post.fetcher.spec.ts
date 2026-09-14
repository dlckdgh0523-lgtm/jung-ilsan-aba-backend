import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseNaverPostHtml } from './naver-post.fetcher';

const fixture = (name: string): string =>
  readFileSync(join(__dirname, '../../test/fixtures/naver', name), 'utf8');

describe('parseNaverPostHtml — SmartEditor ONE (real ilsanaba post fixture)', () => {
  // Sample post logNo 224368986549: 14 image, 8 text, 3 sticker, 2 horizontalLine modules.
  const post = parseNaverPostHtml(fixture('post-smarteditor-one.html'));

  it('reads the og:title', () => {
    expect(post.title).toBe('ABA일산 발달센터 사회성교실 어린이집/학교 모의교실 ^^');
  });

  it('extracts all 14 images via data-lazy-src (not the blurred src placeholder)', () => {
    expect(post.imageUrls).toHaveLength(14);
    for (const url of post.imageUrls) {
      expect(url).toContain('mblogthumb-phinf.pstatic.net');
      expect(url).not.toContain('type=w80_blur');
    }
  });

  it('keeps text paragraphs and their inline emphasis', () => {
    expect(post.bodyHtml).toContain('<b>정지은 일산 ABA</b>');
    expect(post.bodyHtml).toContain('벌써 8월이 다가오면서');
  });

  it('drops stickers and horizontal lines', () => {
    expect(post.dropped.sort()).toEqual([
      'se-horizontalLine',
      'se-horizontalLine',
      'se-sticker',
      'se-sticker',
      'se-sticker',
    ]);
    expect(post.bodyHtml).not.toContain('se-sticker');
  });

  it('emits only block-level tags with escaped attributes', () => {
    expect(post.bodyHtml).toMatch(/^<p>|^<blockquote>|^<h/);
    expect(post.bodyHtml).not.toContain('se-main-container');
  });
});

describe('parseNaverPostHtml — SmartEditor ONE synthetic modules', () => {
  const wrap = (inner: string): string =>
    `<html><head><meta property="og:title" content="t"></head><body><div class="se-main-container">${inner}</div></body></html>`;

  it('converts quotations to <blockquote>', () => {
    const html = wrap(`
      <div class="se-component se-quotation se-l-default">
        <p class="se-text-paragraph"><span>인용문입니다</span></p>
      </div>`);
    expect(parseNaverPostHtml(html).bodyHtml).toBe(
      '<blockquote><p><span>인용문입니다</span></p></blockquote>',
    );
  });

  it('converts oglink modules to a plain anchor with title text', () => {
    const html = wrap(`
      <div class="se-component se-oglink se-l-default">
        <a href="https://example.com/page" class="se-oglink-info">
          <strong class="se-oglink-title">링크 제목</strong>
        </a>
      </div>`);
    expect(parseNaverPostHtml(html).bodyHtml).toBe(
      '<p><a href="https://example.com/page">링크 제목</a></p>',
    );
  });

  it('uses the image caption as alt text', () => {
    const html = wrap(`
      <div class="se-component se-image se-l-default">
        <img data-lazy-src="https://mblogthumb-phinf.pstatic.net/a/b.png?type=w800" src="https://x/blur.png">
        <div class="se-caption">사진 설명</div>
      </div>`);
    expect(parseNaverPostHtml(html).bodyHtml).toContain('alt="사진 설명"');
  });
});

describe('parseNaverPostHtml — legacy editor fallback', () => {
  it('takes #postViewArea raw HTML and collects image URLs', () => {
    const post = parseNaverPostHtml(fixture('post-legacy.html'));
    expect(post.title).toBe('구 에디터 샘플 글');
    expect(post.bodyHtml).toContain('구 에디터로 작성된 글의 본문입니다.');
    expect(post.imageUrls).toEqual([
      'https://postfiles.pstatic.net/MjAyMDAxMDFfMjAw/legacy-sample.jpg?type=w580',
    ]);
  });

  it('throws when no known container exists (parser breakage must be loud)', () => {
    expect(() => parseNaverPostHtml('<html><body><div>nothing</div></body></html>')).toThrow(
      /본문 컨테이너/,
    );
  });
});

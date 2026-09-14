import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseRssXml } from './naver-rss.client';

const fixture = (name: string): string =>
  readFileSync(join(__dirname, '../../test/fixtures/naver', name), 'utf8');

describe('parseRssXml (real ilsanaba RSS fixture)', () => {
  const items = parseRssXml(fixture('rss.xml'), 'ilsanaba');

  it('extracts every item with logNo, canonical url, title, category, date', () => {
    expect(items).toHaveLength(3);
    const [first] = items;
    expect(first.logNo).toBe('224368986549');
    // Canonical URL, not the RSS link with ?fromRss tracking.
    expect(first.url).toBe('https://blog.naver.com/ilsanaba/224368986549');
    expect(first.title).toBe('ABA일산 발달센터 사회성교실 어린이집/학교 모의교실 ^^');
    expect(first.category).toBe('공지');
  });

  it('parses the +0900 pubDate correctly', () => {
    // Wed, 05 Aug 2026 15:55:58 +0900 → 06:55:58 UTC
    expect(items[0].publishedAt.toISOString()).toBe('2026-08-05T06:55:58.000Z');
  });

  it('handles a single <item> (fast-xml-parser yields an object, not an array)', () => {
    const xml = `<?xml version="1.0"?><rss><channel>
      <item><guid>https://blog.naver.com/x/123456789</guid>
        <title>only one</title><category>공지</category>
        <pubDate>Wed, 05 Aug 2026 15:55:58 +0900</pubDate></item>
    </channel></rss>`;
    const single = parseRssXml(xml, 'x');
    expect(single).toHaveLength(1);
    expect(single[0].logNo).toBe('123456789');
  });

  it('drops items without a parsable logNo or date instead of crashing', () => {
    const xml = `<?xml version="1.0"?><rss><channel>
      <item><guid>https://blog.naver.com/x</guid><title>bad</title><pubDate>nope</pubDate></item>
    </channel></rss>`;
    expect(parseRssXml(xml, 'x')).toHaveLength(0);
  });

  it('returns [] for non-RSS content', () => {
    expect(parseRssXml('<html>not rss</html>', 'x')).toHaveLength(0);
  });
});

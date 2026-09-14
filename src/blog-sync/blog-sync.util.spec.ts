import { naverImageCandidates } from './image-mirror.service';
import {
  canonicalPostUrl,
  mobilePostUrl,
  parseNaverPostUrl,
  toKstDisplayDate,
  truncateHtmlBlocks,
} from './blog-sync.util';

describe('naverImageCandidates (image URL normalisation, measured 2026-09-12)', () => {
  it('rewrites mblogthumb ?type=w800 to the blogfiles original, w966 fallback', () => {
    const url = 'https://mblogthumb-phinf.pstatic.net/MjAyNjA4MDNfMjgy/MDAx.PNG/12.png?type=w800';
    expect(naverImageCandidates(url)).toEqual([
      'https://blogfiles.pstatic.net/MjAyNjA4MDNfMjgy/MDAx.PNG/12.png',
      'https://mblogthumb-phinf.pstatic.net/MjAyNjA4MDNfMjgy/MDAx.PNG/12.png?type=w966',
    ]);
  });

  it('handles postfiles host the same way', () => {
    expect(naverImageCandidates('https://postfiles.pstatic.net/a/b.jpg?type=w580')).toEqual([
      'https://blogfiles.pstatic.net/a/b.jpg',
      'https://postfiles.pstatic.net/a/b.jpg?type=w966',
    ]);
  });

  it('keeps a bare blogfiles URL as the single candidate', () => {
    expect(naverImageCandidates('https://blogfiles.pstatic.net/a/b.jpg')).toEqual([
      'https://blogfiles.pstatic.net/a/b.jpg',
      'https://blogfiles.pstatic.net/a/b.jpg?type=w966',
    ]);
  });

  it('refuses non-allowlisted hosts and invalid URLs', () => {
    expect(naverImageCandidates('https://evil.example.com/a.png')).toEqual([]);
    expect(naverImageCandidates('not a url')).toEqual([]);
  });
});

describe('parseNaverPostUrl', () => {
  it('parses the canonical /blogId/logNo form', () => {
    expect(parseNaverPostUrl('https://blog.naver.com/ilsanaba/224368986549')).toEqual({
      blogId: 'ilsanaba',
      logNo: '224368986549',
    });
  });

  it('parses the mobile PostView form', () => {
    expect(
      parseNaverPostUrl(
        'https://m.blog.naver.com/PostView.naver?blogId=ilsanaba&logNo=224368986549',
      ),
    ).toEqual({ blogId: 'ilsanaba', logNo: '224368986549' });
  });

  it('rejects non-Naver hosts (preview endpoint must not become an open proxy)', () => {
    expect(parseNaverPostUrl('https://evil.example.com/ilsanaba/224368986549')).toBeNull();
    expect(parseNaverPostUrl('https://section.blog.naver.com/x/1')).toBeNull();
  });
});

describe('URL builders', () => {
  it('builds canonical and mobile URLs', () => {
    expect(canonicalPostUrl('ilsanaba', '1')).toBe('https://blog.naver.com/ilsanaba/1');
    expect(mobilePostUrl('ilsanaba', '1')).toBe(
      'https://m.blog.naver.com/PostView.naver?blogId=ilsanaba&logNo=1',
    );
  });
});

describe('toKstDisplayDate', () => {
  it('renders in Asia/Seoul with dots', () => {
    // 2026-08-05 15:55:58 +09:00 == 06:55:58Z — must stay Aug 5 in KST.
    expect(toKstDisplayDate(new Date('2026-08-05T06:55:58.000Z'))).toBe('2026.08.05');
  });

  it('rolls the date forward across the UTC midnight boundary', () => {
    // 23:30Z is already the next day in KST.
    expect(toKstDisplayDate(new Date('2026-08-05T23:30:00.000Z'))).toBe('2026.08.06');
  });
});

describe('truncateHtmlBlocks', () => {
  it('leaves short bodies alone', () => {
    expect(truncateHtmlBlocks('<p>짧음</p>', 100)).toEqual({
      html: '<p>짧음</p>',
      truncated: false,
    });
  });

  it('cuts on a block boundary, never inside a tag', () => {
    const html = '<p>one</p><p>two</p><p>three</p>';
    const { html: cut, truncated } = truncateHtmlBlocks(html, 24);
    expect(truncated).toBe(true);
    expect(cut).toBe('<p>one</p><p>two</p><p>… (이하 생략)</p>');
  });
});

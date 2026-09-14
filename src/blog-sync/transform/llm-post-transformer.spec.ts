import type { BlogRssItem, ParsedPost } from '../blog-sync.types';
import {
  LlmPostTransformer,
  fallbackCleanTitle,
  hasInventedNumbers,
  stripHtmlToText,
} from './llm-post-transformer';

const item = (title: string): BlogRssItem => ({
  logNo: '100',
  url: 'https://blog.naver.com/ilsanaba/100',
  title,
  category: '공지',
  publishedAt: new Date('2026-08-05T00:00:00Z'),
});

const post: ParsedPost = {
  title: 'og',
  bodyHtml: '<p>9월 <b>부모교육</b> 특강을 안내드립니다. 문의는 031-977-2575.</p>',
  imageUrls: [],
  dropped: [],
};

function makeTransformer(opts: { enabled?: boolean; raw?: string | Error } = {}) {
  const config = { get: jest.fn().mockReturnValue({ enabled: opts.enabled ?? true }) };
  const llm = {
    completeJson: jest
      .fn()
      .mockImplementation(() =>
        opts.raw instanceof Error ? Promise.reject(opts.raw) : Promise.resolve(opts.raw ?? '{}'),
      ),
  };
  return { t: new LlmPostTransformer(config as never, llm), llm };
}

describe('LlmPostTransformer', () => {
  it('LLM_ENABLED=false → passthrough, no LLM call', async () => {
    const { t, llm } = makeTransformer({ enabled: false });
    const out = await t.transform(post, item('원제목'));
    expect(out).toBe(post);
    expect(llm.completeJson).not.toHaveBeenCalled();
  });

  it('valid output → cleanTitle + summary applied, body untouched', async () => {
    const { t } = makeTransformer({
      raw: '{"title":"9월 부모교육 특강 안내","summary":"9월 부모교육 특강 일정을 안내드립니다."}',
    });
    const out = await t.transform(post, item('일산ABA 9월 부모교육 특강'));
    expect(out.cleanTitle).toBe('9월 부모교육 특강 안내');
    expect(out.summary).toBe('9월 부모교육 특강 일정을 안내드립니다.');
    expect(out.bodyHtml).toBe(post.bodyHtml);
  });

  it('a phone number NOT in the source → whole result discarded, fallback used', async () => {
    const { t } = makeTransformer({
      raw: '{"title":"특강 안내","summary":"문의 02-1234-5678로 연락주세요."}',
    });
    const out = await t.transform(post, item('일산ABA 특강 안내입니다'));
    expect(out.summary).not.toContain('02-1234-5678');
    expect(out.cleanTitle).toBe('특강 안내입니다');
  });

  it('numbers that DO exist in the source pass the check', async () => {
    const { t } = makeTransformer({
      raw: '{"title":"9월 특강 안내","summary":"문의 031-977-2575."}',
    });
    const out = await t.transform(post, item('일산ABA 9월 특강'));
    expect(out.cleanTitle).toBe('9월 특강 안내');
  });

  it('over-length title (>25) → fallback', async () => {
    const { t } = makeTransformer({
      raw: `{"title":"${'가'.repeat(26)}","summary":"요약"}`,
    });
    const out = await t.transform(post, item('파주ABA 여름 프로그램 안내'));
    expect(out.cleanTitle).toBe('여름 프로그램 안내');
  });

  it('JSON parse failure → fallback (sync never throws)', async () => {
    const { t } = makeTransformer({ raw: '죄송합니다, JSON을 만들 수 없습니다' });
    const out = await t.transform(post, item('김포ABA 센터소식 전해드립니다'));
    expect(out.cleanTitle).toBe('센터소식 전해드립니다');
    expect(out.summary).toContain('9월');
  });

  it('category: picks a value from the provided site list and includes the list in the prompt', async () => {
    const { t, llm } = makeTransformer({
      raw: '{"title":"9월 특강 안내","summary":"요약입니다.","category":"부모교육"}',
    });
    const out = await t.transform(post, item('일산ABA 9월 특강'), {
      categories: ['센터소식', '부모교육'],
    });
    expect(out.categoryName).toBe('부모교육');
    expect(String(llm.completeJson.mock.calls[0][1])).toContain(
      '사이트 카테고리 목록: 센터소식, 부모교육',
    );
  });

  it('category: a value NOT in the site list is ignored (falls back to Naver category mapping)', async () => {
    const { t } = makeTransformer({
      raw: '{"title":"9월 특강 안내","summary":"요약입니다.","category":"없는카테고리"}',
    });
    const out = await t.transform(post, item('9월 특강'), { categories: ['센터소식'] });
    expect(out.categoryName).toBeUndefined();
    expect(out.cleanTitle).toBe('9월 특강 안내'); // title/summary still applied
  });

  it('category: no site list given → prompt omits the list and categoryName stays undefined', async () => {
    const { t, llm } = makeTransformer({
      raw: '{"title":"9월 특강 안내","summary":"요약입니다.","category":"센터소식"}',
    });
    const out = await t.transform(post, item('9월 특강'));
    expect(out.categoryName).toBeUndefined();
    expect(String(llm.completeJson.mock.calls[0][1])).not.toContain('사이트 카테고리 목록');
  });

  it('LLM HTTP error → fallback', async () => {
    const { t } = makeTransformer({ raw: new Error('LLM API HTTP 529') });
    const out = await t.transform(post, item('운정ABA 프로그램'));
    expect(out.cleanTitle).toBe('프로그램');
  });
});

describe('fallbackCleanTitle (keyword-stuffed real-world titles)', () => {
  it.each([
    [
      'ABA일산 발달센터 사회성교실 어린이집/학교 모의교실 ^^',
      'ABA일산 발달센터 사회성교실 어린이집/학교 모의교실 ^^',
    ],
    ['일산ABA, 파주ABA, 김포ABA 9월 부모교육 특강 신청 안내', '9월 부모교육 특강 신청 안내'],
    [
      '정지은 일산 ABA 센터소식) 여름방학 사회성 그룹 3기 모집',
      '센터소식) 여름방학 사회성 그룹 3기 모집',
    ],
    [
      '주엽역 5번출구 일산아동발달 — 10월 휴무 안내 (운정ABA, 김포ABA)',
      '일산아동발달 — 10월 휴무 안내',
    ],
    ['일산ABA센터, 파주ABA', '일산ABA센터, 파주ABA'],
  ])('%s → %s', (input, expected) => {
    expect(fallbackCleanTitle(input)).toBe(expected);
  });
});

describe('helpers', () => {
  it('stripHtmlToText flattens tags/entities/whitespace', () => {
    expect(stripHtmlToText('<p>안녕&nbsp;<b>하세요</b></p>\n<p>둘째 &amp; 줄</p>')).toBe(
      '안녕 하세요 둘째 & 줄',
    );
  });

  it('hasInventedNumbers matches digit sequences regardless of separators', () => {
    expect(hasInventedNumbers('문의 031-977-2575', '전화 031 977 2575')).toBe(false);
    expect(hasInventedNumbers('문의 02-1234-5678', '전화 031-977-2575')).toBe(true);
    expect(hasInventedNumbers('숫자 없음', '아무거나')).toBe(false);
  });
});

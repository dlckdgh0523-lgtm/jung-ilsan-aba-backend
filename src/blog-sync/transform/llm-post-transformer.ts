import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';
import type { BlogRssItem, ParsedPost, PostTransformer } from '../blog-sync.types';
import { LLM_CLIENT, type LlmClient } from './llm-client.interface';

const TITLE_MAX = 25;
const SUMMARY_MAX = 80;
const BODY_INPUT_CHARS = 3000;

/** Strip tags/entities to plain text for the LLM input and the summary fallback. */
export function stripHtmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/[\u200B\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * No-LLM title cleanup: strip the SEO keyword run-ons Naver bloggers put in
 * titles (지역명+ABA, 역 출구, 센터 풀네임) plus the commas that glued them on.
 */
export function fallbackCleanTitle(source: string): string {
  // (?![가-힣]) keeps "센터소식" intact while still eating "일산ABA센터".
  const KEYWORD =
    /(?:정지은\s*)?(?:일산|파주|김포|운정|고양|화정|주엽|대화|탄현)\s*(?:정지은\s*)?ABA(?:\s*(?:발달센터|센터)(?![가-힣]))?|주엽역\s*5\s*번\s*출구|정지은\s*일산\s*ABA/gi;
  const cleaned = source
    .replace(KEYWORD, '')
    .replace(/\s*,\s*(?=,|\s|$)/g, '') // commas left dangling by removals
    .replace(/\(\s*[,\s]*\)/g, '') // parens emptied by removals
    .replace(/^[\s,·|/-]+|[\s,·|/-]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const result = cleaned || source.trim();
  return result.slice(0, 60);
}

/** Digit runs (2+) in LLM output must exist verbatim in the source — else it invented facts. */
export function hasInventedNumbers(output: string, sourceText: string): boolean {
  const digits = output.match(/\d[\d\-.:~년월일시분,]*\d|\d{2,}/g) ?? [];
  for (const raw of digits) {
    // Compare digit-sequences only, so "031-977-2575" matches "031 977 2575".
    const seq = raw.replace(/\D/g, '');
    if (seq.length < 2) continue;
    if (!sourceText.replace(/\D/g, '').includes(seq)) return true;
  }
  return false;
}

export const LLM_SYSTEM_PROMPT = `당신은 아동 발달센터 홈페이지의 편집자입니다. 네이버 블로그 글의 제목과 본문 일부를 받아, 홈페이지 소식란에 올릴 제목과 요약을 만듭니다.

규칙:
- title: 25자 이내. 지역명·센터명 검색 키워드 나열("일산ABA", "파주ABA", "주엽역 5번출구" 등)은 전부 제거. 이모지·특수문자 장식 제거. 공지 톤의 한국어 존댓말 명사형 종결("~안내", "~모집", "~소개").
- summary: 80자 이내, 1~2문장. 글의 핵심만.
- 날짜·시간·전화번호·가격·인원·연령·기수 등 사실 정보는 원문에 있는 그대로만 사용하고, 원문에 없는 정보는 절대 만들지 마세요.
- 출력은 JSON 하나만: {"title":"...","summary":"..."} (다른 텍스트 금지)

예시 1:
원제목: "일산ABA, 파주ABA, 김포ABA 주엽역 5번출구 ✨ 9월 부모교육 특강 신청 안내 ✨"
→ {"title":"9월 부모교육 특강 신청 안내","summary":"9월 부모교육 특강 일정과 신청 방법을 안내드립니다."}

예시 2:
원제목: "정지은 일산 ABA 센터소식) 여름방학 사회성 그룹 3기 모집합니다 (일산아바, 운정ABA)"
→ {"title":"여름방학 사회성 그룹 3기 모집","summary":"여름방학 사회성 그룹 3기 모집 소식을 전해드립니다."}`;

/**
 * PostTransformer that asks a small LLM for a clean homepage title + summary.
 * The BODY IS NEVER TOUCHED — only title/summary are produced, and the body
 * text goes nowhere except this one LLM request.
 * Every failure (HTTP, JSON, rule violations) falls back to a regex-cleaned
 * title + text-prefix summary; the sync itself never fails because of this.
 */
@Injectable()
export class LlmPostTransformer implements PostTransformer {
  private readonly logger = new Logger(LlmPostTransformer.name);
  private readonly enabled: boolean;

  constructor(
    config: ConfigService<AppConfig, true>,
    @Optional() @Inject(LLM_CLIENT) private readonly llm: LlmClient | null,
  ) {
    this.enabled = config.get('llm', { infer: true }).enabled;
  }

  async transform(post: ParsedPost, item: BlogRssItem): Promise<ParsedPost> {
    if (!this.enabled || !this.llm) return post; // passthrough — stage-1 behaviour

    const bodyText = stripHtmlToText(post.bodyHtml).slice(0, BODY_INPUT_CHARS);
    const fallback = (): ParsedPost => ({
      ...post,
      cleanTitle: fallbackCleanTitle(item.title),
      summary: bodyText.slice(0, SUMMARY_MAX),
    });

    try {
      const user = `카테고리: ${item.category || '(없음)'}\n원제목: ${item.title}\n본문:\n${bodyText}`;
      const raw = await this.llm.completeJson(LLM_SYSTEM_PROMPT, user);
      const parsed = JSON.parse(extractJson(raw)) as { title?: unknown; summary?: unknown };
      const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';
      const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';

      if (!title || title.length > TITLE_MAX || summary.length > SUMMARY_MAX) return fallback();
      // Invented facts (numbers not present in the source) → discard the whole result.
      const source = `${item.title} ${bodyText}`;
      if (hasInventedNumbers(title, source) || hasInventedNumbers(summary, source)) {
        this.logger.warn(`LLM 결과 폐기 (원문에 없는 숫자): logNo=${item.logNo}`);
        return fallback();
      }
      return { ...post, cleanTitle: title, summary: summary || bodyText.slice(0, SUMMARY_MAX) };
    } catch (e) {
      this.logger.warn(`LLM 제목 생성 실패 → 폴백 (logNo=${item.logNo}): ${(e as Error).message}`);
      return fallback();
    }
  }
}

/** Models sometimes wrap the JSON in prose/code fences — take the first {...} block. */
function extractJson(raw: string): string {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no JSON object in LLM output');
  return raw.slice(start, end + 1);
}

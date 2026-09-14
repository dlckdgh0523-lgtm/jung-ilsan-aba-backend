import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration';
import { PrismaService } from '../prisma/prisma.service';
import { LLM_CLIENT, type LlmClient } from './transform/llm-client.interface';
import { hasInventedNumbers, stripHtmlToText } from './transform/llm-post-transformer';

/** 승인 페이지에 표시되는 GEO 검수 결과. 글에 없는 사실은 절대 만들지 않는다. */
export interface GeoAnalysis {
  analyzedAt: string;
  /** 수치(숫자) 포함 문장 수 — 로컬 계산(결정적), LLM 산출 아님 */
  numericSentenceCount: number;
  /** 출처/근거 언급 여부 — 로컬 패턴 계산 */
  sourceMention: boolean;
  /** 글에 없어서 보완하면 좋을 사실 항목 — "누락" 제안일 뿐 내용 생성 아님 */
  missingFacts: string[];
  /** 글 내용만으로 만든 Q&A (검증 통과분만) — 승인 시 FAQ로 반영 가능 */
  qas: { q: string; a: string }[];
  /** qas로 만든 FAQ JSON-LD 초안 (결정적 생성) */
  faqJsonLdDraft: object | null;
  error?: string;
}

const GEO_SYSTEM_PROMPT = `당신은 아동 발달센터 홈페이지 글의 GEO(AI 검색 최적화) 검수자입니다. 글 전문을 받아 아래 JSON만 출력하세요.

절대 규칙: **글에 없는 사실을 만들지 마세요.** 날짜·가격·연령·횟수·효과 등 글에 없는 정보는 답변에 넣지 말고 "누락" 항목으로만 제안하세요.

출력 JSON:
{
 "missingFacts": ["글에 없어서 보완하면 좋을 사실 항목 (예: 대상 연령, 세션 구조, 신청 방법, 진행 절차)" ...최대 5개, 없으면 []],
 "qas": [{"q":"보호자가 물을 법한 질문","a":"**글에 있는 내용만으로** 만든 답변(2문장 이내)"} ...2~3개, 글 내용이 부족하면 더 적게 또는 []]
}
- q/a는 한국어 존댓말. a에는 글에 없는 수치·사실 금지.
- 다른 텍스트 없이 JSON 하나만 출력.`;

/** 수치 포함 문장 수 — 마침표/줄 단위로 나눠 숫자가 든 문장을 센다. */
export function countNumericSentences(text: string): number {
  return text.split(/(?<=[.!?다요])\s+|\n+/).filter((s) => s.trim().length > 4 && /\d/.test(s))
    .length;
}

/** 출처·근거 언급 휴리스틱. */
export function hasSourceMention(text: string): boolean {
  return /논문|연구에\s*따르|연구 결과|학회|학술지|KCI|DOI|출처|근거\s*기반|소아과학회|보건복지부|질병관리/i.test(
    text,
  );
}

@Injectable()
export class GeoReviewService {
  private readonly logger = new Logger(GeoReviewService.name);
  private readonly enabled: boolean;
  private readonly hasKey: boolean;

  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly prisma: PrismaService,
    @Optional() @Inject(LLM_CLIENT) private readonly llm: LlmClient | null,
  ) {
    this.enabled = config.get('geoReview', { infer: true }).enabled;
    this.hasKey = !!config.get('llm', { infer: true }).apiKey;
  }

  get active(): boolean {
    return this.enabled && this.hasKey && !!this.llm;
  }

  /** 검수 후 결과를 article.geoAnalysis에 저장. 실패해도 동기화에 영향 없음. */
  async analyzeAndStore(articleId: string, title: string, contentHtml: string): Promise<void> {
    if (!this.active) return;
    try {
      const analysis = await this.analyze(title, contentHtml);
      await this.prisma.article.update({
        where: { id: articleId },
        data: { geoAnalysis: analysis as object },
      });
    } catch (e) {
      this.logger.warn(`GEO 검수 실패 (article=${articleId}): ${(e as Error).message}`);
    }
  }

  async analyze(title: string, contentHtml: string): Promise<GeoAnalysis> {
    const text = stripHtmlToText(contentHtml);
    const base: GeoAnalysis = {
      analyzedAt: new Date().toISOString(),
      numericSentenceCount: countNumericSentences(text),
      sourceMention: hasSourceMention(text),
      missingFacts: [],
      qas: [],
      faqJsonLdDraft: null,
    };
    if (!this.llm) return { ...base, error: 'LLM 클라이언트 없음' };

    try {
      const raw = await this.llm.completeJson(
        GEO_SYSTEM_PROMPT,
        `제목: ${title}\n본문:\n${text.slice(0, 6000)}`,
      );
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      const parsed = JSON.parse(raw.slice(start, end + 1)) as {
        missingFacts?: unknown;
        qas?: unknown;
      };
      const missingFacts = (Array.isArray(parsed.missingFacts) ? parsed.missingFacts : [])
        .filter((x): x is string => typeof x === 'string' && !!x.trim())
        .slice(0, 5);
      const source = `${title} ${text}`;
      // 글에 없는 숫자가 든 Q&A는 통째로 폐기 — 날조 방지 게이트
      const qas = (Array.isArray(parsed.qas) ? parsed.qas : [])
        .map((x) => x as { q?: unknown; a?: unknown })
        .filter(
          (x): x is { q: string; a: string } =>
            typeof x.q === 'string' && typeof x.a === 'string' && !!x.q.trim() && !!x.a.trim(),
        )
        .filter((x) => !hasInventedNumbers(x.a, source) && !hasInventedNumbers(x.q, source))
        .slice(0, 3);
      const faqJsonLdDraft =
        qas.length > 0
          ? {
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: qas.map((f) => ({
                '@type': 'Question',
                name: f.q,
                acceptedAnswer: { '@type': 'Answer', text: f.a },
              })),
            }
          : null;
      return { ...base, missingFacts, qas, faqJsonLdDraft };
    } catch (e) {
      return { ...base, error: `LLM 분석 실패: ${(e as Error).message.slice(0, 150)}` };
    }
  }
}

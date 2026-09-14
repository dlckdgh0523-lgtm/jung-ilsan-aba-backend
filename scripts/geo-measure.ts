/**
 * GEO A트랙 자동 측정 — Anthropic API(웹서치)로 고정 프롬프트 20개를 돌려
 * chungaba.com / 정지은일산ABA 언급·인용 여부와 대신 인용된 경쟁 URL을 기록한다.
 *
 * 실행:  ANTHROPIC_API_KEY=<키> npm run geo:measure
 * 출력:  docs/geo-reports/YYYY-MM-DD-api.json / .md
 *
 * 주의: API 측정치는 실제 사용자 화면(ChatGPT 웹·Perplexity 등)과 다를 수 있는
 * 참고 지표다. 공식 기록은 docs/geo-baseline-*.md의 B트랙(수동) 프로토콜을 따른다.
 * 비용 억제: 기본 모델 Haiku, 프롬프트당 웹서치 max_uses=1.
 */
import * as fs from 'fs';
import * as path from 'path';

const API_KEY = process.env.ANTHROPIC_API_KEY || process.env.LLM_API_KEY || '';
const MODEL = process.env.GEO_MEASURE_MODEL || 'claude-haiku-4-5-20251001';
/** 프롬프트당 반복 횟수(1~5). LLM 비결정성 노이즈 완화 — 과반 기준으로 집계. */
const REPEAT = Math.max(1, Math.min(5, parseInt(process.env.GEO_MEASURE_REPEAT || '1', 10) || 1));

export const PROMPTS: string[] = [
  '일산 ABA 센터 추천해줘',
  '고양시 아동 ABA 치료 어디서 받을 수 있어?',
  '일산서구 발달치료 센터 추천해줘',
  '일산에서 자폐 아동 치료 잘하는 곳 알려줘',
  '일산 ABA 치료 받을 수 있는 센터 알려줘',
  '고양시 자폐스펙트럼 조기중재 기관 알려줘',
  '일산에서 무발화 아이 ABA 치료 가능한 곳?',
  '일산 문제행동 치료 센터 추천',
  '파주 운정에서 갈 만한 ABA 센터 있나요?',
  '김포에서 ABA 치료 가능한 곳 알려줘',
  '일산 발달지연 아이 치료센터 추천해줘',
  '고양시에서 ABA 조기교실 운영하는 곳?',
  '일산에 BCBA 자격 치료사가 있는 ABA 센터 있어?',
  '정지은일산ABA는 어떤 곳이야?',
  '일산에서 부모교육 하는 ABA 센터 알려줘',
  '주엽역 근처 아동발달센터 추천',
  '일산 사회성 치료 그룹 프로그램 하는 곳',
  '자폐 아이 ABA 치료, 고양 일산 어디가 좋아?',
  '일산 아동 행동치료 전문기관 알려줘',
  '경기 북부 ABA 전문 센터 추천해줘',
];

interface PromptResult {
  n: number;
  prompt: string;
  ok: boolean;
  error?: string;
  ourMention: boolean; // 응답 본문에 chungaba/정지은 언급
  ourCited: boolean; // 인용/검색결과 URL에 chungaba.com 포함
  citedUrls: { url: string; title?: string }[];
  answerSnippet: string;
  /** 반복 측정 투명성: 언급/인용이 나온 회수와 총 반복 수 */
  mentionRuns?: number;
  citedRuns?: number;
  runsTotal?: number;
}

/** 응답 content 블록에서 텍스트와 인용/검색결과 URL을 수집한다. */
export function parseContent(content: unknown[]): {
  text: string;
  urls: { url: string; title?: string }[];
} {
  let text = '';
  const urls: { url: string; title?: string }[] = [];
  const push = (url?: unknown, title?: unknown) => {
    if (typeof url === 'string' && url.startsWith('http'))
      urls.push({ url, title: typeof title === 'string' ? title : undefined });
  };
  for (const raw of content || []) {
    const b = raw as Record<string, unknown>;
    if (b.type === 'text') {
      text += String(b.text || '') + '\n';
      for (const c of (b.citations as Record<string, unknown>[]) || []) push(c.url, c.title);
    }
    if (b.type === 'web_search_tool_result' && Array.isArray(b.content))
      for (const r of b.content as Record<string, unknown>[]) push(r.url, r.title);
  }
  return { text, urls };
}

/** 프롬프트당 REPEAT회 실행 → 과반 기준 집계 (노이즈 완화). */
async function measureOne(n: number, prompt: string): Promise<PromptResult> {
  const runs: PromptResult[] = [];
  for (let k = 0; k < REPEAT; k++) {
    runs.push(await attemptOne(n, prompt));
    if (k < REPEAT - 1) await new Promise((r) => setTimeout(r, 500));
  }
  const okRuns = runs.filter((r) => r.ok);
  // 집계 규칙(고정, v2): REPEAT회 중 1회 이상 나오면 카운트("any").
  // 규칙을 바꾸면 축이 흔들려 주간 비교가 무의미해진다 — trend.json에 repeat/rule을 함께 기록.
  const need = 1;
  const mentionRuns = okRuns.filter((r) => r.ourMention).length;
  const citedRuns = okRuns.filter((r) => r.ourCited).length;
  const urls = [
    ...new Map(okRuns.flatMap((r) => r.citedUrls).map((u) => [u.url, u])).values(),
  ].slice(0, 8);
  const firstOk = okRuns[0];
  return {
    n,
    prompt,
    ok: okRuns.length > 0,
    error: okRuns.length > 0 ? undefined : runs[0]?.error,
    ourMention: mentionRuns >= need,
    ourCited: citedRuns >= need,
    citedUrls: urls,
    answerSnippet: firstOk ? firstOk.answerSnippet : '',
    mentionRuns,
    citedRuns,
    runsTotal: REPEAT,
  };
}

async function attemptOne(n: number, prompt: string): Promise<PromptResult> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1200,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 1 }],
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    return {
      n,
      prompt,
      ok: false,
      error: `HTTP ${res.status}: ${body.slice(0, 200)}`,
      ourMention: false,
      ourCited: false,
      citedUrls: [],
      answerSnippet: '',
    };
  }
  const data = (await res.json()) as { content: unknown[] };
  const { text, urls } = parseContent(data.content);
  const dedup = [...new Map(urls.map((u) => [u.url, u])).values()];
  return {
    n,
    prompt,
    ok: true,
    ourMention: /chungaba|정지은/i.test(text),
    ourCited: dedup.some((u) => u.url.includes('chungaba.com')),
    citedUrls: dedup.slice(0, 8),
    answerSnippet: text.replace(/\s+/g, ' ').trim().slice(0, 300),
  };
}

async function main(): Promise<void> {
  if (!API_KEY) {
    console.error('ANTHROPIC_API_KEY 환경변수가 필요합니다. (커밋/저장 금지 — 실행 시에만 주입)');
    process.exit(1);
  }
  const date = new Date().toISOString().slice(0, 10);
  const outDir = path.join(__dirname, '..', 'docs', 'geo-reports');
  fs.mkdirSync(outDir, { recursive: true });

  const results: PromptResult[] = [];
  for (let i = 0; i < PROMPTS.length; i++) {
    try {
      results.push(await measureOne(i + 1, PROMPTS[i]));
    } catch (e) {
      results.push({
        n: i + 1,
        prompt: PROMPTS[i],
        ok: false,
        error: String(e).slice(0, 200),
        ourMention: false,
        ourCited: false,
        citedUrls: [],
        answerSnippet: '',
      });
    }
    console.log(
      `[${i + 1}/${PROMPTS.length}] ${results[i].ok ? 'ok' : 'FAIL'} 언급=${results[i].ourMention} 인용=${results[i].ourCited}`,
    );
    await new Promise((r) => setTimeout(r, 700));
  }

  const okCount = results.filter((r) => r.ok).length;
  const mention = results.filter((r) => r.ourMention).length;
  const cited = results.filter((r) => r.ourCited).length;
  const compCount = new Map<string, number>();
  for (const r of results)
    for (const u of r.citedUrls) {
      const host = u.url.replace(/^https?:\/\//, '').split('/')[0];
      if (!host.includes('chungaba')) compCount.set(host, (compCount.get(host) || 0) + 1);
    }
  const topComp = [...compCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);

  fs.writeFileSync(
    path.join(outDir, `${date}-api.json`),
    JSON.stringify({ date, model: MODEL, summary: { okCount, mention, cited }, results }, null, 2),
  );

  // 추세 기록(trend.json) — 관리자 대시보드 "AI 노출 추이" 카드가 이 파일을 읽는다.
  const trendPath = path.join(outDir, 'trend.json');
  let trend: {
    date: string;
    mention: number;
    cited: number;
    ok: number;
    repeat?: number;
    rule?: string;
  }[] = [];
  try {
    trend = JSON.parse(fs.readFileSync(trendPath, 'utf8')) as typeof trend;
  } catch {
    trend = [];
  }
  const prev = [...trend].reverse().find((t) => t.date !== date) ?? null;
  trend = trend.filter((t) => t.date !== date); // 같은 날 재실행 → 갱신
  trend.push({ date, mention, cited, ok: okCount, repeat: REPEAT, rule: 'any' });
  fs.writeFileSync(trendPath, JSON.stringify(trend, null, 2));
  const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
  // 방법론(반복 수)이 다른 시점과의 비교는 참고로만 — 축이 다르다.
  const methodChanged = prev && (prev.repeat ?? 1) !== REPEAT;
  const deltaLine = prev
    ? `직전 측정(${prev.date}) 대비: 언급 ${sign(mention - prev.mention)} · 인용 ${sign(cited - prev.cited)}` +
      (methodChanged
        ? ` ※ 측정 방식 변경(반복 ${prev.repeat ?? 1}→${REPEAT}회) — 직접 비교 금지, 참고만`
        : '')
    : '첫 측정 (비교 대상 없음)';

  const md = `# GEO A트랙 API 측정 리포트 — ${date}

> **주의: API 측정치는 실제 사용자 화면(ChatGPT 웹·Perplexity·네이버 AI브리핑·구글 AI Overview)과 다를 수 있는 참고 지표입니다.** 공식 기록은 B트랙(수동 측정)입니다.

- 모델: ${MODEL} · 웹서치 max_uses=1/요청 · **프롬프트당 ${REPEAT}회 측정, 1회 이상 나오면 카운트(rule=any, v2)**
- 성공 ${okCount}/${PROMPTS.length} · **우리 언급 ${mention}건 · 우리 인용 ${cited}건**
- **${deltaLine}**

## 해석 가이드 (읽고 나서 숫자를 보세요)

- ⚠️ LLM 응답은 비결정적 — 주간 ±1~2 변화는 노이즈 범위. **추세(방향)**로 판단.
- 📌 제로 시점(2026-09-14)의 언급 1건은 **채용공고(사람인·병원잡)가 소스**였음. 채용공고는 마감되면 내려가는 **시한부 소스**라서, 언급이 0으로 떨어져도 사이트가 나빠진 게 아니라 "공고 의존이 끊긴 것"일 수 있다. 진짜 지표는 **인용(chungaba.com이 근거로 쓰였는가)**의 상승이다.
- 📐 반복 수(repeat)가 다른 시점끼리는 축이 달라 직접 비교 금지 — 같은 방법론(반복 ${REPEAT}회)의 첫 측정이 공식 비교 기준선이다.

## 프롬프트별 결과

| # | 질문 | 언급 | 인용 | 대신 인용된 URL(호스트) |
|---|---|---|---|---|
${results
  .map(
    (r) =>
      `| ${r.n} | ${r.prompt} | ${r.ok ? (r.ourMention ? '✅' : '—') : '오류'} | ${r.ourCited ? '✅' : '—'} | ${[...new Set(r.citedUrls.map((u) => u.url.replace(/^https?:\/\//, '').split('/')[0]))].slice(0, 4).join(', ')} |`,
  )
  .join('\n')}

## 경쟁 인용 상위 호스트

${topComp.map(([h, c]) => `- ${h} — ${c}회`).join('\n') || '- (없음)'}

## 응답 발췌

${results.map((r) => `**${r.n}. ${r.prompt}**${r.error ? ` (오류: ${r.error})` : ''}\n> ${r.answerSnippet || '(없음)'}`).join('\n\n')}
`;
  fs.writeFileSync(path.join(outDir, `${date}-api.md`), md);
  console.log(`\n저장: docs/geo-reports/${date}-api.{json,md} + trend.json`);
  console.log(`요약: 성공 ${okCount}/20, 언급 ${mention}, 인용 ${cited} — ${deltaLine}`);

  // 조용한 죽음 방지: 성공률이 낮으면(키 만료·잔액 소진·API 장애) 비정상 종료로 빨간불을 띄운다.
  const minOk = Math.ceil(PROMPTS.length * 0.75);
  if (okCount < minOk) {
    console.error(
      `\n측정 실패: 성공 ${okCount}/${PROMPTS.length} (< ${minOk}) — API 키·잔액·Anthropic 상태를 확인하세요.`,
    );
    process.exitCode = 2;
  }
}

if (require.main === module) void main();

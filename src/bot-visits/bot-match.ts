/** 추적 대상 크롤러 UA 토큰 → 표시 이름. 부분 문자열 매칭(대소문자 무시). */
export const BOT_PATTERNS: [pattern: string, label: string][] = [
  ['GPTBot', 'GPTBot(OpenAI)'],
  ['OAI-SearchBot', 'OAI-SearchBot(OpenAI)'],
  ['ChatGPT-User', 'ChatGPT-User(OpenAI)'],
  ['ClaudeBot', 'ClaudeBot(Anthropic)'],
  ['Claude-Web', 'Claude-Web(Anthropic)'],
  ['Claude-User', 'Claude-User(Anthropic)'],
  ['PerplexityBot', 'PerplexityBot'],
  ['Perplexity-User', 'Perplexity-User'],
  ['Google-Extended', 'Google-Extended'],
  ['Googlebot', 'Googlebot'],
  ['bingbot', 'Bingbot'],
  ['Yeti', 'Yeti(네이버)'],
  ['Amazonbot', 'Amazonbot'],
  ['CCBot', 'CCBot(CommonCrawl)'],
  ['Bytespider', 'Bytespider(ByteDance)'],
];

/** UA가 추적 대상 봇이면 표시 이름, 아니면 null. */
export function matchBot(userAgent: string | undefined): string | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();
  for (const [pattern, label] of BOT_PATTERNS) {
    if (ua.includes(pattern.toLowerCase())) return label;
  }
  return null;
}

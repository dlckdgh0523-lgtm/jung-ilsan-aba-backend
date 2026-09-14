import { matchBot } from './bot-match';

describe('matchBot', () => {
  it('추적 대상 봇 UA를 라벨로 매칭한다', () => {
    expect(
      matchBot(
        'Mozilla/5.0 AppleWebKit/537.36 (compatible; GPTBot/1.2; +https://openai.com/gptbot)',
      ),
    ).toBe('GPTBot(OpenAI)');
    expect(matchBot('Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)')).toBe(
      'ClaudeBot(Anthropic)',
    );
    expect(matchBot('Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai)')).toBe(
      'PerplexityBot',
    );
    expect(matchBot('Mozilla/5.0 (compatible; Yeti/1.1; +https://naver.me/spd)')).toBe(
      'Yeti(네이버)',
    );
    expect(
      matchBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'),
    ).toBe('Googlebot');
    expect(matchBot('Mozilla/5.0 (compatible; bingbot/2.0)')).toBe('Bingbot');
  });

  it('일반 브라우저/빈 UA는 null', () => {
    expect(matchBot('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0')).toBeNull();
    expect(matchBot(undefined)).toBeNull();
    expect(matchBot('')).toBeNull();
  });

  it('대소문자 무시 매칭', () => {
    expect(matchBot('gptbot/1.0')).toBe('GPTBot(OpenAI)');
  });
});

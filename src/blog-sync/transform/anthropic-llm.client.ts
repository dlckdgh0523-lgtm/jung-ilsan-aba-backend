import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';
import { BLOG_FETCH, type FetchLike } from '../blog-sync.types';
import type { LlmClient } from './llm-client.interface';

const API_URL = 'https://api.anthropic.com/v1/messages';
const TIMEOUT_MS = 20_000;

/**
 * Anthropic Messages API over plain fetch (no SDK dependency — the call shape
 * is 10 lines and every network path in blog-sync is behind the FETCH token).
 */
@Injectable()
export class AnthropicLlmClient implements LlmClient {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(
    @Inject(BLOG_FETCH) private readonly fetchFn: FetchLike,
    config: ConfigService<AppConfig, true>,
  ) {
    const llm = config.get('llm', { infer: true });
    this.apiKey = llm.apiKey;
    this.model = llm.model;
  }

  async completeJson(system: string, user: string): Promise<string> {
    const res = await this.fetchFn(API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 500,
        system,
        messages: [{ role: 'user', content: user }],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`LLM API HTTP ${res.status}`);
    const body = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = (body.content ?? []).find((b) => b.type === 'text')?.text;
    if (!text) throw new Error('LLM API returned no text block');
    return text;
  }
}

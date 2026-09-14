import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes } from 'node:crypto';
import type { AppConfig } from '../../config/configuration';
import { BLOG_FETCH, type FetchLike } from '../../blog-sync/blog-sync.types';
import type {
  AlimtalkProvider,
  AlimtalkSendInput,
  AlimtalkSendResult,
} from '../alimtalk-provider.interface';

const API_BASE = 'https://api.solapi.com';
const TIMEOUT_MS = 15_000;

/**
 * SOLAPI auth header (docs: developers.solapi.com → API Key 인증 방식):
 *   Authorization: HMAC-SHA256 apiKey=<key>, date=<ISO8601>, salt=<random>,
 *                  signature=HMAC_SHA256(date + salt, apiSecret)
 * Exported for a deterministic unit test.
 */
export function buildSolapiAuthHeader(
  apiKey: string,
  apiSecret: string,
  date: string,
  salt: string,
): string {
  const signature = createHmac('sha256', apiSecret)
    .update(date + salt)
    .digest('hex');
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

interface SolapiSendResponse {
  messageId?: string;
  statusCode?: string;
  statusMessage?: string;
  // /messages/v4/send actually nests under groupInfo/messageList in some
  // shapes; we read defensively.
  messageList?: Record<string, { statusCode?: string; statusMessage?: string }>;
}

@Injectable()
export class SolapiProvider implements AlimtalkProvider {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly senderKey: string;
  private readonly fallbackSms: boolean;

  constructor(
    @Inject(BLOG_FETCH) private readonly fetchFn: FetchLike,
    config: ConfigService<AppConfig, true>,
  ) {
    const a = config.get('alimtalk', { infer: true });
    this.apiKey = a.apiKey;
    this.apiSecret = a.apiSecret;
    this.senderKey = a.senderKey;
    this.fallbackSms = a.fallbackSms;
  }

  private authHeader(): string {
    const date = new Date().toISOString();
    const salt = randomBytes(16).toString('hex');
    return buildSolapiAuthHeader(this.apiKey, this.apiSecret, date, salt);
  }

  async send(input: AlimtalkSendInput): Promise<AlimtalkSendResult> {
    // SOLAPI variable keys carry the template's #{} wrapper verbatim.
    const variables: Record<string, string> = {};
    for (const [k, v] of Object.entries(input.variables)) variables[`#{${k}}`] = v;

    const res = await this.fetchFn(`${API_BASE}/messages/v4/send`, {
      method: 'POST',
      headers: { Authorization: this.authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          to: input.to,
          kakaoOptions: {
            pfId: this.senderKey,
            templateId: input.templateCode,
            variables,
            // Default is SMS-fallback ON at solapi; v1 keeps it off (needs a
            // registered sender number + per-SMS cost to turn on).
            disableSms: !this.fallbackSms,
          },
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const body = (await res.json().catch(() => ({}))) as SolapiSendResponse;
    if (!res.ok) {
      throw new Error(
        `솔라피 발송 실패 (HTTP ${res.status}): ${body.statusMessage ?? JSON.stringify(body).slice(0, 200)}`,
      );
    }
    return {
      providerMessageId: body.messageId ?? Object.keys(body.messageList ?? {})[0] ?? '',
      status: body.statusCode ?? 'ACCEPTED',
    };
  }

  async getStatus(providerMessageId: string): Promise<string> {
    const res = await this.fetchFn(
      `${API_BASE}/messages/v4/list?messageId=${encodeURIComponent(providerMessageId)}`,
      {
        headers: { Authorization: this.authHeader() },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    if (!res.ok) return `HTTP_${res.status}`;
    const body = (await res.json().catch(() => ({}))) as {
      messageList?: Record<string, { status?: string; statusCode?: string }>;
    };
    const first = Object.values(body.messageList ?? {})[0];
    return first?.status ?? first?.statusCode ?? 'UNKNOWN';
  }
}

import { Injectable, Logger } from '@nestjs/common';

/** DI token for the operational alert channel. */
export const OPS_ALERT = Symbol('OPS_ALERT');

/**
 * Where "a human should look at this" events go (alimtalk send failures,
 * kakao/LLM breakage, parser drift). Default implementation just logs;
 * swap the provider for Slack/email later without touching call sites.
 */
export interface OpsAlert {
  notify(level: 'warn' | 'error', message: string, meta?: Record<string, unknown>): void;
}

@Injectable()
export class LoggerOpsAlert implements OpsAlert {
  private readonly logger = new Logger('OpsAlert');

  notify(level: 'warn' | 'error', message: string, meta?: Record<string, unknown>): void {
    const suffix = meta ? ` ${JSON.stringify(meta)}` : '';
    if (level === 'error') this.logger.error(`${message}${suffix}`);
    else this.logger.warn(`${message}${suffix}`);
  }
}

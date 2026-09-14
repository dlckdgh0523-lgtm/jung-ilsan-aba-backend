import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { matchBot } from './bot-match';
import { BotVisitsService } from './bot-visits.service';

/** 모든 요청에서 크롤러 UA를 감지해 기록한다 (SSR 경로 포함 전 경로 커버). */
@Injectable()
export class BotVisitMiddleware implements NestMiddleware {
  constructor(private readonly visits: BotVisitsService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const ua = req.headers['user-agent'];
    const bot = matchBot(typeof ua === 'string' ? ua : undefined);
    if (bot) this.visits.record(bot, String(ua), req.originalUrl || req.url, req.ip);
    next();
  }
}

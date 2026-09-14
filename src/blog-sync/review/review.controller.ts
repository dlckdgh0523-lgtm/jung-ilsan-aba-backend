import { Body, Controller, Get, Header, Param, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { AppConfig } from '../../config/configuration';
import { ReviewService, type ReviewState } from './review.service';
import {
  renderDecided,
  renderExpired,
  renderHandledElsewhere,
  renderNotFound,
  renderReviewForm,
} from './review-pages';

/**
 * The no-login approval page the director opens from the alimtalk button.
 * The URL token IS the credential: random 32 bytes, hashed at rest, one-time.
 * The only powers behind it are publish and hold — no edit, no delete, no pin.
 */
@Controller('blog-sync/review')
@Throttle({ default: { limit: 20, ttl: 60_000 } })
export class ReviewController {
  private readonly apiPublicBase: string;

  constructor(
    private readonly reviews: ReviewService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.apiPublicBase = config.get('apiPublicBase', { infer: true });
  }

  @Get(':token')
  @Header('Cache-Control', 'no-store')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  async page(@Param('token') token: string, @Res() res: Response): Promise<void> {
    const state = await this.reviews.findByToken(token);
    this.render(res, state, { formWhenOk: true });
  }

  @Post(':token')
  @Header('Cache-Control', 'no-store')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  async decide(
    @Param('token') token: string,
    @Body() body: { action?: string; useSourceTitle?: string },
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // The secret URL is the CSRF defence; when the browser does send
    // Origin/Referer, they must at least point back at this API.
    if (this.apiPublicBase && this.crossOrigin(req)) {
      res.status(403).type('html').send(renderNotFound());
      return;
    }
    const action = body.action === 'publish' ? 'publish' : body.action === 'hold' ? 'hold' : null;
    if (!action) {
      res.status(400).type('html').send(renderNotFound());
      return;
    }
    const state = await this.reviews.decide(token, action, body.useSourceTitle === 'on');
    this.render(res, state, { formWhenOk: false });
  }

  private crossOrigin(req: Request): boolean {
    for (const header of ['origin', 'referer'] as const) {
      const value = req.headers[header];
      if (typeof value === 'string' && value && !value.startsWith(this.apiPublicBase)) return true;
    }
    return false;
  }

  private render(res: Response, state: ReviewState, opts: { formWhenOk: boolean }): void {
    res.type('html');
    switch (state.kind) {
      case 'ok':
        // POST never lands here (decide() returns 'decided'), but keep it total.
        res.send(
          opts.formWhenOk
            ? renderReviewForm(state.review.article, state.review.summary, state.review.expiresAt)
            : renderNotFound(),
        );
        return;
      case 'decided':
        res.send(
          renderDecided(state.review.article, state.review.decision ?? '', state.review.decidedAt),
        );
        return;
      case 'handled-elsewhere':
        res.send(renderHandledElsewhere(state.review.article));
        return;
      case 'expired':
        res.status(410).send(renderExpired());
        return;
      default:
        res.status(404).send(renderNotFound());
    }
  }
}

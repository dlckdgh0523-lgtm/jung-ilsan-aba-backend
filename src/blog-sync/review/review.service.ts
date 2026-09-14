import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Article, ArticleReview } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { AppException } from '../../common/exceptions/app.exception';
import type { AppConfig } from '../../config/configuration';
import { PrismaService } from '../../prisma/prisma.service';

export type ReviewWithArticle = ArticleReview & { article: Article };

/** Why a review link can't be acted on (drives which page the controller renders). */
export type ReviewState =
  | { kind: 'ok'; review: ReviewWithArticle }
  | { kind: 'expired'; review: ReviewWithArticle }
  | { kind: 'decided'; review: ReviewWithArticle }
  /** Admin already published/deleted the article through the admin page. */
  | { kind: 'handled-elsewhere'; review: ReviewWithArticle }
  | { kind: 'invalid' };

@Injectable()
export class ReviewService {
  private readonly secret: string;
  private readonly ttlDays: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<AppConfig, true>,
  ) {
    const rt = config.get('reviewToken', { infer: true });
    this.secret = rt.secret;
    this.ttlDays = rt.ttlDays;
  }

  /** SHA-256 of token (+ secret pepper when configured) — the raw token is never stored. */
  hashToken(token: string): string {
    return createHash('sha256')
      .update(token + this.secret)
      .digest('hex');
  }

  /**
   * Create (or re-key) the review row for an article and return the ONE-TIME
   * plaintext token. Re-issuing rotates the hash, which invalidates any link
   * sent earlier. Refused once a decision has been made.
   */
  async issue(
    articleId: string,
    summary?: string | null,
  ): Promise<{ token: string; review: ArticleReview }> {
    const existing = await this.prisma.articleReview.findUnique({ where: { articleId } });
    if (existing?.decidedAt) {
      throw AppException.conflict('이미 공개/보류가 결정된 글입니다.', 'REVIEW_ALREADY_DECIDED');
    }
    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + this.ttlDays * 24 * 60 * 60 * 1000);
    const review = await this.prisma.articleReview.upsert({
      where: { articleId },
      create: { articleId, tokenHash, expiresAt, summary: summary ?? null },
      update: { tokenHash, expiresAt, ...(summary !== undefined ? { summary } : {}) },
    });
    return { token, review };
  }

  async findByToken(token: string): Promise<ReviewState> {
    const review = await this.prisma.articleReview.findUnique({
      where: { tokenHash: this.hashToken(token) },
      include: { article: true },
    });
    if (!review) return { kind: 'invalid' };
    if (review.decidedAt) return { kind: 'decided', review };
    // The admin page beat the link to it: already published, or deleted.
    if (review.article.deletedAt || review.article.status === 'published') {
      return { kind: 'handled-elsewhere', review };
    }
    if (review.expiresAt < new Date()) return { kind: 'expired', review };
    return { kind: 'ok', review };
  }

  /**
   * Apply the reviewer's decision. publish → the article goes live (optionally
   * with the original blog title restored); hold → nothing changes on the
   * article. Either way the link is spent and cannot be reused.
   */
  async decide(
    token: string,
    action: 'publish' | 'hold',
    useSourceTitle: boolean,
  ): Promise<ReviewState> {
    const state = await this.findByToken(token);
    if (state.kind !== 'ok') return state;
    const { review } = state;

    if (action === 'publish') {
      await this.prisma.article.update({
        where: { id: review.articleId },
        data: {
          status: 'published',
          visible: true,
          // Sync pre-sets publishedAt to the blog date; stamp only if absent.
          ...(review.article.publishedAt ? {} : { publishedAt: new Date() }),
          ...(useSourceTitle && review.article.sourceTitle
            ? { title: review.article.sourceTitle }
            : {}),
        },
      });
    }

    const decided = await this.prisma.articleReview.update({
      where: { id: review.id },
      data: { decidedAt: new Date(), decision: action, decidedVia: 'kakao-link' },
      include: { article: true },
    });
    return { kind: 'decided', review: decided };
  }
}

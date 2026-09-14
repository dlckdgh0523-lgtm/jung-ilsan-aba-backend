import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Article, ArticleReview } from '@prisma/client';
import { AppException } from '../common/exceptions/app.exception';
import { OPS_ALERT, type OpsAlert } from '../common/services/ops-alert';
import type { AppConfig } from '../config/configuration';
import { PrismaService } from '../prisma/prisma.service';
import { ALIMTALK_PROVIDER, type AlimtalkProvider } from './alimtalk-provider.interface';

/** Template variable cap from the review template design (title line). */
const TITLE_VAR_MAX = 40;

export interface SendOutcome {
  sent: number;
  failed: number;
  results: { to: string; id: string | null; status: string }[];
}

const kstDate = (d: Date): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(d).replaceAll('-', '.');

@Injectable()
export class AlimtalkService {
  private readonly logger = new Logger(AlimtalkService.name);
  /** Last send outcome, for GET /alimtalk/status (in-memory, single instance). */
  private lastSend: { at: Date; outcome: SendOutcome; context: string } | null = null;

  constructor(
    @Inject(ALIMTALK_PROVIDER) private readonly provider: AlimtalkProvider,
    @Inject(OPS_ALERT) private readonly ops: OpsAlert,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  private get settings() {
    return this.config.get('alimtalk', { infer: true });
  }

  get enabled(): boolean {
    return this.settings.enabled;
  }

  /**
   * Send the "새 글 승인 요청" template to every configured recipient.
   * Per-recipient failures don't fail the rest; the aggregate lands on the
   * ArticleReview row (notifiedAt / notifyError / providerMessageIds).
   * Never throws — a dead dealer must not fail the sync.
   */
  async sendReviewRequest(
    article: Article,
    review: ArticleReview,
    token: string,
  ): Promise<SendOutcome> {
    const { templateReview } = this.settings;
    const variables = {
      title: article.title.slice(0, TITLE_VAR_MAX),
      date: article.publishedAt ? kstDate(article.publishedAt) : kstDate(new Date()),
      expires: kstDate(review.expiresAt),
      token,
    };
    const outcome = await this.sendToAll(templateReview, variables, `review:${article.id}`);

    await this.prisma.articleReview.update({
      where: { id: review.id },
      data: {
        notifiedAt: outcome.sent > 0 ? new Date() : null,
        notifyError:
          outcome.failed > 0
            ? outcome.results
                .filter((r) => r.id === null)
                .map((r) => `${r.to}: ${r.status}`)
                .join('\n')
                .slice(0, 2000)
            : null,
        providerMessageIds: outcome.results,
      },
    });
    return outcome;
  }

  /** One test message to the first (or given) recipient — for setup verification. */
  async sendTest(to?: string): Promise<SendOutcome> {
    if (!this.enabled) {
      throw AppException.badRequest(
        '알림톡이 비활성화되어 있습니다 (ALIMTALK_ENABLED).',
        'ALIMTALK_DISABLED',
      );
    }
    const recipient = to ?? this.settings.recipients[0];
    if (!recipient) {
      throw AppException.badRequest(
        'ALIMTALK_RECIPIENTS가 비어 있습니다.',
        'ALIMTALK_NO_RECIPIENT',
      );
    }
    const variables = {
      title: '알림톡 연동 테스트',
      date: kstDate(new Date()),
      expires: kstDate(new Date(Date.now() + 7 * 86400_000)),
      token: 'test-invalid-token',
    };
    return this.sendToOne(this.settings.templateReview, variables, recipient, 'test');
  }

  status(): {
    enabled: boolean;
    provider: string;
    recipients: string[];
    templateReview: string;
    fallbackSms: boolean;
    lastSend: { at: Date; context: string; outcome: SendOutcome } | null;
  } {
    const { enabled, provider, recipients, templateReview, fallbackSms } = this.settings;
    // Mask recipient numbers a little for the status payload.
    const masked = recipients.map((r) => r.replace(/(\d{3})\d{3,4}(\d{4})/, '$1****$2'));
    return {
      enabled,
      provider,
      recipients: masked,
      templateReview,
      fallbackSms,
      lastSend: this.lastSend
        ? { at: this.lastSend.at, context: this.lastSend.context, outcome: this.lastSend.outcome }
        : null,
    };
  }

  private async sendToAll(
    templateCode: string,
    variables: Record<string, string>,
    context: string,
  ): Promise<SendOutcome> {
    if (!this.enabled) return { sent: 0, failed: 0, results: [] };
    const outcome: SendOutcome = { sent: 0, failed: 0, results: [] };
    for (const to of this.settings.recipients) {
      const one = await this.sendToOne(templateCode, variables, to, context);
      outcome.sent += one.sent;
      outcome.failed += one.failed;
      outcome.results.push(...one.results);
    }
    this.lastSend = { at: new Date(), outcome, context };
    if (outcome.failed > 0) {
      this.ops.notify('error', `알림톡 발송 실패 ${outcome.failed}건 (${context})`, {
        results: outcome.results,
      });
    }
    return outcome;
  }

  private async sendToOne(
    templateCode: string,
    variables: Record<string, string>,
    to: string,
    context: string,
  ): Promise<SendOutcome> {
    try {
      const r = await this.provider.send({ to, templateCode, variables });
      const outcome: SendOutcome = {
        sent: 1,
        failed: 0,
        results: [{ to, id: r.providerMessageId, status: r.status }],
      };
      if (context === 'test') this.lastSend = { at: new Date(), outcome, context };
      return outcome;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(`알림톡 발송 실패 (${to}, ${context}): ${message}`);
      const outcome: SendOutcome = {
        sent: 0,
        failed: 1,
        results: [{ to, id: null, status: message.slice(0, 300) }],
      };
      if (context === 'test') this.lastSend = { at: new Date(), outcome, context };
      return outcome;
    }
  }
}

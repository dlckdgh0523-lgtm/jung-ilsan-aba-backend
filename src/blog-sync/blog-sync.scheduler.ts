import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import type { AppConfig } from '../config/configuration';
import { BlogSyncService } from './blog-sync.service';

/**
 * In-process cron (the host is an always-on paid instance — no sleep to worry
 * about). Registered dynamically so BLOG_SYNC_ENABLED=false means no job at
 * all, not a job that no-ops.
 */
@Injectable()
export class BlogSyncScheduler implements OnModuleInit {
  private readonly logger = new Logger(BlogSyncScheduler.name);

  constructor(
    private readonly registry: SchedulerRegistry,
    private readonly service: BlogSyncService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  onModuleInit(): void {
    const { enabled, cron } = this.config.get('blogSync', { infer: true });
    if (!enabled) return;
    const job = new CronJob(cron, () => void this.tick(), null, false, 'Asia/Seoul');
    this.registry.addCronJob('blog-sync', job);
    job.start();
    this.logger.log(`블로그 동기화 크론 등록: ${cron} (Asia/Seoul)`);
  }

  private async tick(): Promise<void> {
    try {
      await this.service.run('cron');
    } catch (e) {
      // Includes the "already running" conflict — a long manual run overlapping
      // the schedule is fine, the next tick catches up.
      this.logger.error(`블로그 동기화 크론 실패: ${(e as Error).message}`);
    }
  }
}

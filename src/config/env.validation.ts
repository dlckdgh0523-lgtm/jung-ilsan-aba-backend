import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';

class EnvVars {
  @IsOptional()
  @IsIn(['development', 'test', 'production'])
  NODE_ENV?: string;

  @IsOptional()
  @IsInt()
  PORT?: number;

  @IsString()
  @MinLength(1)
  DATABASE_URL!: string;

  @IsString()
  @MinLength(16, { message: 'JWT_SECRET must be at least 16 characters' })
  JWT_SECRET!: string;

  @IsOptional()
  @IsInt()
  JWT_TTL_SECONDS?: number;

  // Only the seed consumes this, so boot must not die when it's absent —
  // but when it IS set, a weak value is refused early.
  @ValidateIf(
    (o: EnvVars) => o.ADMIN_DEFAULT_PASSWORD !== undefined && o.ADMIN_DEFAULT_PASSWORD !== '',
  )
  @MinLength(10, { message: 'ADMIN_DEFAULT_PASSWORD must be at least 10 characters' })
  ADMIN_DEFAULT_PASSWORD?: string;

  // Optional vars use ValidateIf(non-empty) instead of @IsOptional: dotenv turns a
  // bare `VAR=` line into '' (not undefined), which @IsOptional would still validate.
  @ValidateIf((o: EnvVars) => o.BLOG_SYNC_ENABLED !== undefined && o.BLOG_SYNC_ENABLED !== '')
  @IsIn(['true', 'false'])
  BLOG_SYNC_ENABLED?: string;

  // Required only when the sync is actually turned on.
  @ValidateIf((o: EnvVars) => o.BLOG_SYNC_ENABLED === 'true')
  @IsString({ message: 'NAVER_BLOG_ID is required when BLOG_SYNC_ENABLED=true' })
  @MinLength(1, { message: 'NAVER_BLOG_ID is required when BLOG_SYNC_ENABLED=true' })
  NAVER_BLOG_ID?: string;

  @IsOptional()
  @IsString()
  BLOG_SYNC_CRON?: string;

  @IsOptional()
  @IsInt()
  BLOG_SYNC_MAX_PER_RUN?: number;

  @ValidateIf((o: EnvVars) => o.BLOG_SYNC_SINCE !== undefined && o.BLOG_SYNC_SINCE !== '')
  @IsISO8601({}, { message: 'BLOG_SYNC_SINCE must be an ISO date (e.g. 2026-09-01)' })
  BLOG_SYNC_SINCE?: string;

  @ValidateIf((o: EnvVars) => o.ALIMTALK_ENABLED !== undefined && o.ALIMTALK_ENABLED !== '')
  @IsIn(['true', 'false'])
  ALIMTALK_ENABLED?: string;

  // The whole alimtalk credential set is required only when the feature is on.
  @ValidateIf((o: EnvVars) => o.ALIMTALK_ENABLED === 'true')
  @MinLength(1, { message: 'ALIMTALK_API_KEY is required when ALIMTALK_ENABLED=true' })
  ALIMTALK_API_KEY?: string;

  @ValidateIf((o: EnvVars) => o.ALIMTALK_ENABLED === 'true')
  @MinLength(1, { message: 'ALIMTALK_API_SECRET is required when ALIMTALK_ENABLED=true' })
  ALIMTALK_API_SECRET?: string;

  @ValidateIf((o: EnvVars) => o.ALIMTALK_ENABLED === 'true')
  @MinLength(1, { message: 'ALIMTALK_SENDER_KEY is required when ALIMTALK_ENABLED=true' })
  ALIMTALK_SENDER_KEY?: string;

  @ValidateIf((o: EnvVars) => o.ALIMTALK_ENABLED === 'true')
  @MinLength(1, { message: 'ALIMTALK_TEMPLATE_REVIEW is required when ALIMTALK_ENABLED=true' })
  ALIMTALK_TEMPLATE_REVIEW?: string;

  @ValidateIf((o: EnvVars) => o.ALIMTALK_ENABLED === 'true')
  @MinLength(1, { message: 'ALIMTALK_RECIPIENTS is required when ALIMTALK_ENABLED=true' })
  ALIMTALK_RECIPIENTS?: string;

  @ValidateIf((o: EnvVars) => o.ALIMTALK_ENABLED === 'true')
  @MinLength(8, { message: 'API_PUBLIC_BASE is required when ALIMTALK_ENABLED=true' })
  API_PUBLIC_BASE?: string;

  @ValidateIf((o: EnvVars) => o.REVIEW_TOKEN_SECRET !== undefined && o.REVIEW_TOKEN_SECRET !== '')
  @MinLength(32, { message: 'REVIEW_TOKEN_SECRET must be at least 32 characters' })
  REVIEW_TOKEN_SECRET?: string;

  @IsOptional()
  @IsInt()
  REVIEW_TOKEN_TTL_DAYS?: number;

  @ValidateIf((o: EnvVars) => o.LLM_ENABLED !== undefined && o.LLM_ENABLED !== '')
  @IsIn(['true', 'false'])
  LLM_ENABLED?: string;

  @ValidateIf((o: EnvVars) => o.LLM_ENABLED === 'true')
  @MinLength(1, { message: 'LLM_API_KEY is required when LLM_ENABLED=true' })
  LLM_API_KEY?: string;

  @IsOptional()
  @IsInt()
  BLOG_SYNC_FETCH_TIMEOUT_MS?: number;
}

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const validated = plainToInstance(EnvVars, config, { enableImplicitConversion: true });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors
      .map((e) => Object.values(e.constraints ?? {}).join(', '))
      .filter(Boolean)
      .join('\n  - ');
    throw new Error(`Invalid environment variables:\n  - ${details}`);
  }
  return config;
}

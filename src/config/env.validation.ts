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

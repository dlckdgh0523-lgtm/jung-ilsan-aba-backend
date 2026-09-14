export interface AppConfig {
  env: string;
  port: number;
  apiPrefix: string;
  jwt: { secret: string; ttlSeconds: number };
  admin: { username: string; password: string };
  corsOrigins: string[];
  upload: {
    driver: 'local' | 's3';
    dir: string;
    publicBase: string;
    maxBytes: number;
    imageMaxWidth: number;
  };
  s3: {
    region: string;
    bucket: string;
    publicBase: string;
    keyPrefix: string;
    endpoint: string;
    forcePathStyle: boolean;
  };
  consultation: { rateTtl: number; rateLimit: number };
  stats: { concurrentWindowSeconds: number };
  static: { enabled: boolean; root: string };
  blogSync: {
    enabled: boolean;
    blogId: string;
    cron: string;
    /** Category allowlist (trimmed). Empty = every category is imported. */
    categories: string[];
    maxPerRun: number;
    /** ISO cutoff — posts published before this are never imported. Empty = first-run time. */
    since: string;
    fetchTimeoutMs: number;
  };
  /** Public origin of THIS API (review links in alimtalk messages point here). */
  apiPublicBase: string;
  reviewToken: {
    /** Pepper mixed into the token hash. Optional but recommended (32+ random chars). */
    secret: string;
    ttlDays: number;
  };
  alimtalk: {
    enabled: boolean;
    provider: string;
    apiKey: string;
    apiSecret: string;
    /** 카카오 발신프로필 키 (솔라피 pfId). */
    senderKey: string;
    /** 승인 요청 템플릿 코드 (딜러사 심사 통과 후 발급). */
    templateReview: string;
    /** 수신 번호 목록 (하이픈 없이). */
    recipients: string[];
    /** true면 알림톡 실패 시 SMS/LMS 대체 발송 (딜러사 기능, 발신번호 등록 필요). v1은 끔. */
    fallbackSms: boolean;
  };
  llm: {
    enabled: boolean;
    provider: string;
    apiKey: string;
    model: string;
  };
  geoReview: {
    enabled: boolean;
  };
}

const toInt = (v: string | undefined, fallback: number): number => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
};

const toList = (v: string | undefined): string[] =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export default (): AppConfig => ({
  env: process.env.NODE_ENV ?? 'development',
  port: toInt(process.env.PORT, 4000),
  apiPrefix: process.env.API_PREFIX ?? 'v1',
  jwt: {
    secret: process.env.JWT_SECRET ?? 'insecure-dev-secret-change-me',
    ttlSeconds: toInt(process.env.JWT_TTL_SECONDS, 43200),
  },
  admin: {
    username: process.env.ADMIN_DEFAULT_USERNAME ?? 'admin',
    // No fallback on purpose — a guessable default password must never exist.
    // Only the seed consumes this, and seed.ts refuses to run without it.
    password: process.env.ADMIN_DEFAULT_PASSWORD ?? '',
  },
  corsOrigins: toList(process.env.CORS_ORIGINS),
  upload: {
    driver: process.env.UPLOAD_DRIVER === 's3' ? 's3' : 'local',
    dir: process.env.UPLOAD_DIR ?? 'storage/uploads',
    publicBase: process.env.UPLOAD_PUBLIC_BASE ?? '/uploads',
    maxBytes: toInt(process.env.UPLOAD_MAX_BYTES, 5 * 1024 * 1024),
    imageMaxWidth: toInt(process.env.UPLOAD_IMAGE_MAX_WIDTH, 1600),
  },
  s3: {
    region: process.env.S3_REGION ?? 'ap-northeast-2',
    bucket: process.env.S3_BUCKET ?? '',
    publicBase: (process.env.S3_PUBLIC_BASE ?? '').replace(/\/+$/, ''),
    keyPrefix: process.env.S3_KEY_PREFIX ?? 'uploads/',
    // S3-compatible providers (Cloudflare R2, Backblaze B2, MinIO, KT Cloud Object Storage…).
    // e.g. R2: https://<ACCOUNT_ID>.r2.cloudflarestorage.com  — leave empty for AWS S3.
    endpoint: (process.env.S3_ENDPOINT ?? '').replace(/\/+$/, ''),
    // Most S3-compatible providers need path-style addressing; default ON when a custom
    // endpoint is set, overridable with S3_FORCE_PATH_STYLE=true|false.
    forcePathStyle:
      process.env.S3_FORCE_PATH_STYLE != null
        ? process.env.S3_FORCE_PATH_STYLE === 'true'
        : Boolean(process.env.S3_ENDPOINT),
  },
  consultation: {
    rateTtl: toInt(process.env.CONSULTATION_RATE_TTL, 60),
    rateLimit: toInt(process.env.CONSULTATION_RATE_LIMIT, 5),
  },
  stats: {
    concurrentWindowSeconds: toInt(process.env.STATS_CONCURRENT_WINDOW_SECONDS, 90),
  },
  static: {
    enabled: (process.env.SERVE_STATIC ?? 'true') === 'true',
    root: process.env.STATIC_ROOT ?? '../aba-design-system',
  },
  blogSync: {
    enabled: process.env.BLOG_SYNC_ENABLED === 'true',
    blogId: process.env.NAVER_BLOG_ID ?? '',
    cron: process.env.BLOG_SYNC_CRON ?? '*/30 * * * *',
    categories: toList(process.env.BLOG_SYNC_CATEGORIES),
    maxPerRun: toInt(process.env.BLOG_SYNC_MAX_PER_RUN, 5),
    since: process.env.BLOG_SYNC_SINCE ?? '',
    fetchTimeoutMs: toInt(process.env.BLOG_SYNC_FETCH_TIMEOUT_MS, 15000),
  },
  apiPublicBase: (process.env.API_PUBLIC_BASE ?? '').replace(/\/+$/, ''),
  reviewToken: {
    secret: process.env.REVIEW_TOKEN_SECRET ?? '',
    ttlDays: toInt(process.env.REVIEW_TOKEN_TTL_DAYS, 7),
  },
  alimtalk: {
    enabled: process.env.ALIMTALK_ENABLED === 'true',
    provider: process.env.ALIMTALK_PROVIDER ?? 'solapi',
    apiKey: process.env.ALIMTALK_API_KEY ?? '',
    apiSecret: process.env.ALIMTALK_API_SECRET ?? '',
    senderKey: process.env.ALIMTALK_SENDER_KEY ?? '',
    templateReview: process.env.ALIMTALK_TEMPLATE_REVIEW ?? '',
    recipients: toList(process.env.ALIMTALK_RECIPIENTS),
    fallbackSms: process.env.ALIMTALK_FALLBACK_SMS === 'true',
  },
  llm: {
    enabled: process.env.LLM_ENABLED === 'true',
    provider: process.env.LLM_PROVIDER ?? 'anthropic',
    // ANTHROPIC_API_KEY도 허용 — GEO 검수(geo-review)와 키 하나로 공용
    apiKey: process.env.LLM_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? '',
    model: process.env.LLM_MODEL ?? 'claude-haiku-4-5',
  },
  geoReview: {
    // 기본 off — GEO_REVIEW_ENABLED=true + API 키가 있을 때만 동작
    enabled: process.env.GEO_REVIEW_ENABLED === 'true',
  },
});

export interface AppConfig {
  env: string;
  port: number;
  apiPrefix: string;
  jwt: { secret: string; ttlSeconds: number };
  admin: { username: string; password: string };
  corsOrigins: string[];
  upload: {
    dir: string;
    publicBase: string;
    maxBytes: number;
    imageMaxWidth: number;
  };
  consultation: { rateTtl: number; rateLimit: number };
  stats: { concurrentWindowSeconds: number };
  static: { enabled: boolean; root: string };
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
    password: process.env.ADMIN_DEFAULT_PASSWORD ?? 'aba1234',
  },
  corsOrigins: toList(process.env.CORS_ORIGINS),
  upload: {
    dir: process.env.UPLOAD_DIR ?? 'storage/uploads',
    publicBase: process.env.UPLOAD_PUBLIC_BASE ?? '/uploads',
    maxBytes: toInt(process.env.UPLOAD_MAX_BYTES, 5 * 1024 * 1024),
    imageMaxWidth: toInt(process.env.UPLOAD_IMAGE_MAX_WIDTH, 1600),
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
});

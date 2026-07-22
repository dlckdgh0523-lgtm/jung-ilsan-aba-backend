import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import type { AppConfig } from '../../config/configuration';
import { SaveOptions, StorageService, StoredFile } from './storage.interface';

const CONTENT_TYPE: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

/**
 * S3 storage (enabled with UPLOAD_DRIVER=s3). Credentials resolve via the default AWS
 * chain — on EC2 attach an IAM instance role (s3:PutObject/DeleteObject); on PaaS hosts
 * (Render 등) set AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY env vars instead.
 * S3-compatible providers (Cloudflare R2, Backblaze B2, MinIO…) work by setting
 * S3_ENDPOINT — the SDK then talks to that endpoint with path-style addressing.
 * NOTE: with a custom endpoint, S3_PUBLIC_BASE is REQUIRED (the AWS-style default URL
 * would be wrong) — e.g. an R2 public bucket domain (r2.dev) or a custom CDN domain.
 * Swappable with LocalStorageService via STORAGE_SERVICE.
 */
@Injectable()
export class S3StorageService implements StorageService {
  private readonly logger = new Logger('S3Storage');
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly keyPrefix: string;
  private readonly publicBase: string;

  constructor(config: ConfigService<AppConfig, true>) {
    const s3 = config.get('s3', { infer: true });
    if (!s3.bucket)
      this.logger.warn('UPLOAD_DRIVER=s3 but S3_BUCKET is empty — uploads will fail.');
    if (s3.endpoint && !s3.publicBase)
      this.logger.warn(
        'S3_ENDPOINT is set but S3_PUBLIC_BASE is empty — uploaded file URLs will be wrong. ' +
          'Set S3_PUBLIC_BASE to the public domain of the bucket (e.g. R2 r2.dev URL or CDN).',
      );
    this.client = new S3Client({
      region: s3.region,
      ...(s3.endpoint ? { endpoint: s3.endpoint, forcePathStyle: s3.forcePathStyle } : {}),
    });
    this.bucket = s3.bucket;
    this.keyPrefix = s3.keyPrefix.replace(/^\/+/, ''); // no leading slash in S3 keys
    this.publicBase = s3.publicBase || `https://${s3.bucket}.s3.${s3.region}.amazonaws.com`;
  }

  async save(buffer: Buffer, ext: string, opts?: SaveOptions): Promise<StoredFile> {
    const key = `${this.keyPrefix}${randomUUID()}.${ext}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: opts?.contentType ?? CONTENT_TYPE[ext] ?? 'application/octet-stream',
        ...(opts?.contentDisposition ? { ContentDisposition: opts.contentDisposition } : {}),
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return { url: `${this.publicBase}/${key}`, key };
  }

  async remove(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import type { AppConfig } from '../../config/configuration';
import { StorageService, StoredFile } from './storage.interface';

const CONTENT_TYPE: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

/**
 * S3 storage (enabled with UPLOAD_DRIVER=s3). Credentials resolve via the default AWS
 * chain — on EC2 attach an IAM instance role (s3:PutObject/DeleteObject), so NO keys in env.
 * The bucket must allow public GetObject (or front it with CloudFront and point
 * S3_PUBLIC_BASE at the CDN domain). Swappable with LocalStorageService via STORAGE_SERVICE.
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
    this.client = new S3Client({ region: s3.region });
    this.bucket = s3.bucket;
    this.keyPrefix = s3.keyPrefix.replace(/^\/+/, ''); // no leading slash in S3 keys
    this.publicBase = s3.publicBase || `https://${s3.bucket}.s3.${s3.region}.amazonaws.com`;
  }

  async save(buffer: Buffer, ext: string): Promise<StoredFile> {
    const key = `${this.keyPrefix}${randomUUID()}.${ext}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: CONTENT_TYPE[ext] ?? 'application/octet-stream',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return { url: `${this.publicBase}/${key}`, key };
  }

  async remove(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

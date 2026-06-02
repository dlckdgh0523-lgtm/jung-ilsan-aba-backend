import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdirSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { basename, isAbsolute, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AppConfig } from '../../config/configuration';
import { StorageService, StoredFile } from './storage.interface';

/**
 * Local-disk storage. Files land in `upload.dir`; URLs are `${publicBase}/${key}`
 * (Nginx/static-assets serves that prefix). Swap this provider for S3/GCS later.
 */
@Injectable()
export class LocalStorageService implements StorageService {
  private readonly dir: string;
  private readonly publicBase: string;

  constructor(config: ConfigService<AppConfig, true>) {
    const upload = config.get('upload', { infer: true });
    this.dir = isAbsolute(upload.dir) ? upload.dir : resolve(process.cwd(), upload.dir);
    this.publicBase = upload.publicBase.replace(/\/+$/, '');
    mkdirSync(this.dir, { recursive: true });
  }

  async save(buffer: Buffer, ext: string): Promise<StoredFile> {
    const key = `${randomUUID()}.${ext}`;
    await writeFile(join(this.dir, key), buffer);
    return { url: `${this.publicBase}/${key}`, key };
  }

  async remove(key: string): Promise<void> {
    // basename() neutralises any path-traversal in a caller-supplied key.
    await rm(join(this.dir, basename(key)), { force: true });
  }
}

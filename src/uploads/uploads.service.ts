import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { AppException } from '../common/exceptions/app.exception';
import { STORAGE_SERVICE, StorageService } from '../common/storage/storage.interface';
import type { AppConfig } from '../config/configuration';

/** sharp output format → file extension. Anything else falls back to `bin`. */
const EXT_BY_FORMAT: Record<string, string> = { jpeg: 'jpg', png: 'png', webp: 'webp', gif: 'gif' };

export interface UploadResult {
  url: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
}

@Injectable()
export class UploadsService {
  private readonly maxWidth: number;

  constructor(
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.maxWidth = config.get('upload', { infer: true }).imageMaxWidth;
  }

  /** Re-encode + downscale to `maxWidth`, persist, and return the public URL. */
  async saveImage(file: Express.Multer.File): Promise<UploadResult> {
    if (!file?.buffer?.length) {
      throw AppException.unprocessable('업로드할 파일이 없습니다.', 'FILE_REQUIRED', {
        file: '이미지 파일을 선택해 주세요.',
      });
    }

    let out: { data: Buffer; info: sharp.OutputInfo };
    try {
      out = await sharp(file.buffer, { animated: true })
        .rotate() // honour EXIF orientation, then strip it
        .resize({ width: this.maxWidth, withoutEnlargement: true })
        .toBuffer({ resolveWithObject: true });
    } catch {
      throw AppException.unprocessable('유효한 이미지 파일이 아닙니다.', 'INVALID_IMAGE', {
        file: '손상되었거나 지원하지 않는 이미지입니다.',
      });
    }

    const ext = EXT_BY_FORMAT[out.info.format] ?? 'bin';
    const stored = await this.storage.save(out.data, ext);
    return {
      url: stored.url,
      width: out.info.width,
      height: out.info.height,
      bytes: out.info.size,
      format: out.info.format,
    };
  }
}

import { HttpStatus, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AppException } from '../common/exceptions/app.exception';
import { LocalStorageService } from '../common/storage/local-storage.service';
import { STORAGE_SERVICE } from '../common/storage/storage.interface';
import type { AppConfig } from '../config/configuration';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

@Module({
  imports: [
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        storage: memoryStorage(),
        limits: { fileSize: config.get('upload', { infer: true }).maxBytes, files: 1 },
        fileFilter: (_req, file, cb) => {
          if (ALLOWED_MIME.has(file.mimetype)) {
            cb(null, true);
            return;
          }
          cb(
            new AppException(
              HttpStatus.UNPROCESSABLE_ENTITY,
              'UNSUPPORTED_MEDIA_TYPE',
              '지원하지 않는 이미지 형식입니다. (jpg, png, webp, gif)',
            ),
            false,
          );
        },
      }),
    }),
  ],
  controllers: [UploadsController],
  providers: [UploadsService, { provide: STORAGE_SERVICE, useClass: LocalStorageService }],
})
export class UploadsModule {}

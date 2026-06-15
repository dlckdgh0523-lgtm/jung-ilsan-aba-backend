import { Controller, HttpStatus, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { AppException } from '../common/exceptions/app.exception';
import { FileUploadResult, UploadResult, UploadsService } from './uploads.service';

/**
 * Extensions allowed as notice attachments. Stored with `Content-Disposition: attachment`
 * (forced download, never executed inline), so documents + archives are safe to accept.
 */
const ALLOWED_FILE_EXT = new Set([
  'pdf',
  'hwp',
  'hwpx',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'csv',
  'txt',
  'rtf',
  'zip',
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
]);

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  /** `POST /uploads` — multipart field `file`; returns the stored image URL + dimensions. */
  @Post()
  @AdminOnly()
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file: Express.Multer.File): Promise<UploadResult> {
    return this.uploads.saveImage(file);
  }

  /**
   * `POST /uploads/file` — multipart field `file`; stores any document (xlsx/pdf/hwp/...) for download.
   * Overrides the module-level image-only `fileFilter` so notice attachments aren't wrongly rejected.
   */
  @Post('file')
  @AdminOnly()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 16 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const match = (file.originalname || '').match(/\.([A-Za-z0-9]{1,8})$/);
        const ext = match ? match[1].toLowerCase() : '';
        if (ALLOWED_FILE_EXT.has(ext)) {
          cb(null, true);
          return;
        }
        cb(
          new AppException(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'UNSUPPORTED_MEDIA_TYPE',
            '지원하지 않는 파일 형식입니다. (pdf, hwp, doc/docx, xls/xlsx, ppt/pptx, csv, txt, rtf, zip, 이미지)',
          ),
          false,
        );
      },
    }),
  )
  uploadFile(@UploadedFile() file: Express.Multer.File): Promise<FileUploadResult> {
    return this.uploads.saveFile(file);
  }
}

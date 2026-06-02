import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { UploadResult, UploadsService } from './uploads.service';

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
}

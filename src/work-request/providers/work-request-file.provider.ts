import { basename, extname } from 'node:path';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import type { WorkRequestUploadedFile } from '../work-request.service';

@Injectable()
export class WorkRequestFileProvider {
  assertMapping(uploads: WorkRequestUploadedFile[], codes: string[]): void {
    if (uploads.length !== codes.length)
      throw this.bad(
        'Each uploaded file requires one Document Code in matching order.',
      );
  }
  originalName(value: string): string {
    const name = basename(value).trim();
    if (!name || name.length > 260)
      throw this.bad('Uploaded filename is invalid.');
    return name;
  }
  extension(name: string): string {
    const extension = extname(name).toLowerCase();
    if (!extension) throw this.bad('Uploaded file is invalid.');
    return extension;
  }
  private bad(message: string) {
    return new AppException({
      code: AppErrorCode.BadRequest,
      status: HttpStatus.BAD_REQUEST,
      message,
    });
  }
}

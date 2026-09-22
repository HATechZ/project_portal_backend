import { basename, extname } from 'node:path';
import { HttpStatus } from '@nestjs/common';
import { AppErrorCode } from '../common/exceptions/app-error-code';
import { AppException } from '../common/exceptions/app-exception';

const APPROVED_UPLOAD_TYPES: Readonly<Record<string, readonly string[]>> = {
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  '.ppt': ['application/vnd.ms-powerpoint'],
  '.pptx': [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  '.csv': ['text/csv', 'application/csv'],
  '.txt': ['text/plain'],
  '.dwg': ['application/acad', 'application/x-acad', 'image/vnd.dwg'],
  '.dxf': ['application/dxf', 'image/vnd.dxf'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.zip': ['application/zip', 'application/x-zip-compressed'],
};
export function safeProjectOriginalName(value: string): string {
  const name = basename(value).trim();
  if (!name || name.length > 260)
    throw invalid('Uploaded filename is invalid.');
  return name;
}
export function assertProjectUploadAllowed(file: {
  originalname: string;
  mimetype: string;
}): void {
  const extension = extname(
    safeProjectOriginalName(file.originalname),
  ).toLowerCase();
  if (!APPROVED_UPLOAD_TYPES[extension]?.includes(file.mimetype.toLowerCase()))
    throw invalid('Uploaded file type does not match the approved allowlist.');
}
export function projectFileExtension(name: string): string {
  return extname(name).toLowerCase();
}
function invalid(message: string): AppException {
  return new AppException({
    code: AppErrorCode.BadRequest,
    status: HttpStatus.BAD_REQUEST,
    message,
  });
}

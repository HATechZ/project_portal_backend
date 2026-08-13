import { HttpException, HttpStatus } from '@nestjs/common';
import { AppErrorCode } from './app-error-code';

export interface AppExceptionOptions {
  code: AppErrorCode;
  message: string;
  status?: HttpStatus;
  details?: unknown;
  cause?: unknown;
}

export class AppException extends HttpException {
  readonly code: AppErrorCode;
  readonly details?: unknown;

  constructor(options: AppExceptionOptions) {
    const status = options.status ?? HttpStatus.BAD_REQUEST;
    super(
      {
        code: options.code,
        message: options.message,
        details: options.details,
      },
      status,
      {
        cause: options.cause,
      },
    );
    this.code = options.code;
    this.details = options.details;
  }
}

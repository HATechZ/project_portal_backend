import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { RequestContext } from '../context/request-context';
import { AppErrorCode } from './app-error-code';
import { AppException } from './app-exception';
import { mapPrismaException } from './prisma-exception.map';

interface ErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(thrown: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const exception = mapPrismaException(thrown) ?? thrown;
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const error = this.toErrorBody(exception, status);

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.originalUrl}`,
        thrown instanceof Error ? thrown.stack : String(thrown),
      );
    }

    response.status(status).json({
      success: false,
      error,
      meta: {
        requestId: RequestContext.requestId(),
        timestamp: new Date().toISOString(),
      },
    });
  }

  private toErrorBody(exception: unknown, status: number): ErrorBody {
    if (exception instanceof AppException) {
      return {
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === 'string')
        return {
          code: this.codeFor(status),
          message: this.userMessageFor(status),
        };
      const payload = body as Record<string, unknown>;
      return {
        code:
          typeof payload.code === 'string'
            ? payload.code
            : this.codeFor(status),
        message: this.userMessageFor(status),
      };
    }
    return {
      code: AppErrorCode.InternalError,
      message: this.userMessageFor(HttpStatus.INTERNAL_SERVER_ERROR),
    };
  }

  private userMessageFor(status: number): string {
    const messages: Partial<Record<number, string>> = {
      [HttpStatus.BAD_REQUEST]:
        'Some information is invalid. Correct the highlighted fields and try again.',
      [HttpStatus.UNAUTHORIZED]:
        'Your session has expired or is no longer valid. Sign in again to continue.',
      [HttpStatus.FORBIDDEN]:
        "You don't have permission to perform this action. Contact your administrator if you need access.",
      [HttpStatus.NOT_FOUND]:
        'The requested resource was not found. Refresh the page and try again.',
      [HttpStatus.CONFLICT]:
        'This change cannot be completed because it conflicts with the current record state. Refresh and try again.',
      [HttpStatus.TOO_MANY_REQUESTS]:
        'Too many attempts. Wait a moment and try again.',
      [HttpStatus.SERVICE_UNAVAILABLE]:
        'This service is temporarily unavailable. Please try again shortly.',
      [HttpStatus.INTERNAL_SERVER_ERROR]:
        "We couldn't complete your request because of an unexpected error. Try again. If the problem continues, contact support.",
    };
    return (
      messages[status] ??
      "We couldn't complete your request because of an unexpected error. Try again. If the problem continues, contact support."
    );
  }

  private codeFor(status: number): AppErrorCode {
    const codes: Partial<Record<number, AppErrorCode>> = {
      400: AppErrorCode.BadRequest,
      401: AppErrorCode.Unauthorized,
      403: AppErrorCode.Forbidden,
      404: AppErrorCode.NotFound,
      409: AppErrorCode.Conflict,
      429: AppErrorCode.RateLimitExceeded,
      503: AppErrorCode.ServiceUnavailable,
    };
    return codes[status] ?? AppErrorCode.InternalError;
  }
}

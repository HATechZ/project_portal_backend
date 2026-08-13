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
  message: string | string[];
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
        return { code: this.codeFor(status), message: body };
      const payload = body as Record<string, unknown>;
      return {
        code:
          typeof payload.code === 'string'
            ? payload.code
            : this.codeFor(status),
        message: (payload.message as string | string[]) ?? exception.message,
        details: payload.details,
      };
    }
    return {
      code: AppErrorCode.InternalError,
      message: 'An unexpected error occurred',
    };
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

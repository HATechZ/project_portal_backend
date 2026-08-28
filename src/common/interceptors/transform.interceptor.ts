import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import { ApiResponseDto } from '../dto/api-response.dto';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponseDto<T> | T
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponseDto<T> | T> {
    const response = context.switchToHttp().getResponse<Response>();
    const configuredMessage = this.reflector.getAllAndOverride<string>(
      RESPONSE_MESSAGE_KEY,
      [context.getHandler(), context.getClass()],
    );

    return next.handle().pipe(
      map((data) => {
        if (data instanceof StreamableFile || this.isWrapped(data)) return data;

        return {
          success: true,
          message:
            configuredMessage ??
            (response.statusCode === 201
              ? 'Resource created successfully'
              : 'Request successful'),
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }

  private isWrapped(value: unknown): value is T {
    return (
      typeof value === 'object' &&
      value !== null &&
      'success' in value &&
      'data' in value
    );
  }
}

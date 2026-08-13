import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { RequestContext } from '../context/request-context';

export interface ApiEnvelope<T> {
  success: true;
  data: T;
  meta: { requestId?: string; timestamp: string };
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiEnvelope<T> | T
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiEnvelope<T> | T> {
    return next.handle().pipe(
      map((data) => {
        if (data instanceof StreamableFile || this.isEnvelope(data))
          return data;
        return {
          success: true,
          data,
          meta: {
            requestId: RequestContext.requestId(),
            timestamp: new Date().toISOString(),
          },
        };
      }),
    );
  }

  private isEnvelope(value: unknown): value is ApiEnvelope<T> {
    return (
      typeof value === 'object' &&
      value !== null &&
      'success' in value &&
      ('data' in value || 'error' in value)
    );
  }
}

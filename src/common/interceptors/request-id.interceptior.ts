import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { RequestContext } from '../context/request-context';
import { normalizeRequestId, REQUEST_ID_HEADER } from '../utils/request-id';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const requestId = normalizeRequestId(request.headers[REQUEST_ID_HEADER]);
    response.setHeader(REQUEST_ID_HEADER, requestId);
    return new Observable((subscriber) => {
      RequestContext.run({ requestId }, () => {
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (error: unknown) => subscriber.error(error),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}

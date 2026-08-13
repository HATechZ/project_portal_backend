import { createHash } from 'node:crypto';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, map } from 'rxjs';
import {
  ETAG_HEADER,
  ETAG_MAX_BODY_BYTES,
  IF_NONE_MATCH_HEADER,
} from '../constants/etg';

@Injectable()
export class EtagInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    if (!['GET', 'HEAD'].includes(request.method)) return next.handle();

    return next.handle().pipe(
      map((body: unknown) => {
        const serialized = JSON.stringify(body);
        if (!serialized || Buffer.byteLength(serialized) > ETAG_MAX_BODY_BYTES)
          return body;
        const etag = `W/"${createHash('sha256').update(serialized).digest('base64url')}"`;
        response.setHeader(ETAG_HEADER, etag);
        if (request.headers[IF_NONE_MATCH_HEADER] === etag)
          response.status(304);
        return body;
      }),
    );
  }
}

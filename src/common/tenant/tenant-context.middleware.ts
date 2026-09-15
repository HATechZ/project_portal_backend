import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { RequestContext } from '../context/request-context';
import { normalizeRequestId, REQUEST_ID_HEADER } from '../utils/request-id';

export type TenantRequest = Request & { tenantId?: string };

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(request: TenantRequest, response: Response, next: NextFunction): void {
    const requestId = normalizeRequestId(request.headers[REQUEST_ID_HEADER]);
    response.setHeader(REQUEST_ID_HEADER, requestId);
    // Authentication decides the Tenant. Header validation is deferred to the
    // Tenant guard for routes that explicitly use a header (refresh/recovery).
    RequestContext.run({ requestId }, next);
  }
}

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { NextFunction, Request, Response } from 'express';
import 'express-session';
import { RequestContext } from '../context/request-context';
import { normalizeRequestId, REQUEST_ID_HEADER } from '../utils/request-id';
import { TENANT_ID_HEADER } from './tenant.constants';

export type TenantRequest = Request & { tenantId?: string };

declare module 'express-session' {
  interface SessionData {
    tenantId?: string;
  }
}

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(request: TenantRequest, response: Response, next: NextFunction): void {
    const headerTenantId = this.headerTenantId(request);
    const sessionTenantId = request.session?.tenantId;
    if (
      headerTenantId &&
      sessionTenantId &&
      headerTenantId !== sessionTenantId
    ) {
      throw new ForbiddenException(
        'The requested tenant does not match the authenticated session',
      );
    }

    const requestId = normalizeRequestId(request.headers[REQUEST_ID_HEADER]);
    const tenantId = sessionTenantId ?? headerTenantId;
    request.tenantId = tenantId;
    response.setHeader(REQUEST_ID_HEADER, requestId);
    RequestContext.run({ requestId, tenantId }, next);
  }

  private headerTenantId(request: Request): string | undefined {
    const value = request.headers[TENANT_ID_HEADER];
    if (value === undefined) return undefined;
    if (Array.isArray(value) || !isUUID(value)) {
      throw new BadRequestException(`${TENANT_ID_HEADER} must be a valid UUID`);
    }
    return value;
  }
}

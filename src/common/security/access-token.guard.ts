import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { isUUID } from 'class-validator';
import { RequestContext } from '../context/request-context';
import { AppErrorCode } from '../exceptions/app-error-code';
import { AppException } from '../exceptions/app-exception';
import {
  SESSION_AUTHENTICATOR,
  type AccessTokenPayload,
  type SessionAuthenticator,
} from './session-authenticator.port';

export type AccessTokenRequest = Request & {
  tenantId?: string;
  accessTokenPayload?: AccessTokenPayload;
};

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    @Inject(SESSION_AUTHENTICATOR)
    private readonly authenticator: SessionAuthenticator,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AccessTokenRequest>();
    const authorization = request.headers.authorization;
    const match = authorization?.match(/^\s*Bearer\s+(\S+)\s*$/i);
    if (!match) {
      throw new AppException({
        code: AppErrorCode.AuthRequired,
        status: 401,
        message: 'You need to sign in to access this page.',
      });
    }
    request.accessTokenPayload = await this.authenticator.verifyAccessToken(
      match[1],
    );
    const tenantId = request.accessTokenPayload.tenantId;
    if (!isUUID(tenantId)) {
      throw sessionExpired();
    }
    // Only a verified token may establish the authenticated request's Tenant.
    RequestContext.setTenantId(tenantId);
    request.tenantId = tenantId;
    return true;
  }
}

function sessionExpired(): AppException {
  return new AppException({
    code: AppErrorCode.AuthSessionExpired,
    status: 401,
    message:
      'Your session has expired or is no longer valid. Sign in again to continue.',
  });
}

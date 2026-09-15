import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { isUUID } from 'class-validator';
import { RequestContext } from '../context/request-context';
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
      throw new UnauthorizedException('Bearer access token required');
    }
    request.accessTokenPayload = await this.authenticator.verifyAccessToken(
      match[1],
    );
    const tenantId = request.accessTokenPayload.tenantId;
    if (!isUUID(tenantId)) {
      throw new UnauthorizedException('Invalid access token Tenant');
    }
    // Only a verified token may establish the authenticated request's Tenant.
    RequestContext.setTenantId(tenantId);
    request.tenantId = tenantId;
    return true;
  }
}

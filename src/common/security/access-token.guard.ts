import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import {
  SESSION_AUTHENTICATOR,
  type AccessTokenPayload,
  type SessionAuthenticator,
} from './session-authenticator.port';

export type AccessTokenRequest = Request & {
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
    return true;
  }
}

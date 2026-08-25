import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AccessTokenPayload, AuthTokenProvider } from '../../providers';

export type AccessTokenRequest = Request & {
  accessTokenPayload?: AccessTokenPayload;
};

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly tokenProvider: AuthTokenProvider) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AccessTokenRequest>();
    const authorization = request.headers.authorization;
    const match = authorization?.match(/^\s*Bearer\s+(\S+)\s*$/i);
    if (!match) {
      throw new UnauthorizedException('Bearer access token required');
    }
    request.accessTokenPayload = await this.tokenProvider.verifyAccessToken(
      match[1],
    );
    return true;
  }
}

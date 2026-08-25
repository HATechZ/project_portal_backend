import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthTokenProvider } from '../providers';
import { SessionActor, SessionUser } from '../repositories';
import { RequestContext } from '../../common/context/request-context';

export type AuthenticatedRequest = Request & {
  user?: SessionUser;
  actor?: SessionActor;
  authSessionId?: string;
};

@Injectable()
export class AuthenticatedGuard implements CanActivate {
  constructor(private readonly tokenProvider: AuthTokenProvider) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.bearerToken(request);
    const payload = await this.tokenProvider.verifyAccessToken(token);
    if (payload.tenantId !== RequestContext.requireTenantId()) {
      throw new UnauthorizedException(
        'Access token is not valid for this tenant',
      );
    }
    if (!(await this.tokenProvider.isSessionActive(payload.sid, payload.sub))) {
      throw new UnauthorizedException(
        'Authentication session is no longer active',
      );
    }

    const user = await this.tokenProvider.findActiveUser(payload.sub);
    if (!user) throw new UnauthorizedException('Authentication required');
    const actor = await this.tokenProvider.findActiveActor(payload.sub);
    if (!actor) {
      throw new ForbiddenException(
        'No active actor profile is available for this account',
      );
    }
    RequestContext.setActorId(actor.id);
    request.user = user;
    request.actor = actor;
    request.authSessionId = payload.sid;
    return true;
  }

  private bearerToken(request: Request): string {
    const authorization = request.headers.authorization;
    const match = authorization?.match(/^\s*Bearer\s+(\S+)\s*$/i);
    if (!match) {
      throw new UnauthorizedException('Bearer access token required');
    }
    return match[1];
  }
}

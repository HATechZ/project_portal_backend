import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { RequestContext } from '../context/request-context';
import { AccessTokenRequest } from './access-token.guard';
import {
  SESSION_AUTHENTICATOR,
  type SessionAuthenticator,
} from './session-authenticator.port';
import { SessionActor, SessionUser } from './session.types';

export type AuthenticationRequest = AccessTokenRequest & {
  user?: SessionUser;
  actor?: SessionActor;
  authSessionId?: string;
};

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    @Inject(SESSION_AUTHENTICATOR)
    private readonly authenticator: SessionAuthenticator,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticationRequest>();
    const payload = request.accessTokenPayload;
    if (!payload) {
      throw new UnauthorizedException('Access token validation is required');
    }
    if (payload.tenantId !== RequestContext.requireTenantId()) {
      throw new UnauthorizedException(
        'Access token is not valid for this tenant',
      );
    }
    if (!(await this.authenticator.isSessionActive(payload.sid, payload.sub))) {
      throw new UnauthorizedException(
        'Authentication session is no longer active',
      );
    }

    const user = await this.authenticator.findActiveUser(payload.sub);
    if (!user) throw new UnauthorizedException('Authentication required');
    const actor = await this.authenticator.findActiveActor(payload.sub);
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
}

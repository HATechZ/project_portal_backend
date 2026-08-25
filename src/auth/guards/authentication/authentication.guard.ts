import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { RequestContext } from '../../../common/context/request-context';
import { AuthTokenProvider } from '../../providers';
import { SessionActor, SessionUser } from '../../repositories';
import { AccessTokenRequest } from '../access-token/access-token.guard';

export type AuthenticationRequest = AccessTokenRequest & {
  user?: SessionUser;
  actor?: SessionActor;
  authSessionId?: string;
};

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(private readonly tokenProvider: AuthTokenProvider) {}

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
}

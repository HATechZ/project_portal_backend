import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { RequestContext } from '../context/request-context';
import { AppErrorCode } from '../exceptions/app-error-code';
import { AppException } from '../exceptions/app-exception';
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
      throw authRequired();
    }
    if (payload.tenantId !== RequestContext.requireTenantId()) {
      throw sessionExpired();
    }
    if (!(await this.authenticator.isSessionActive(payload.sid, payload.sub))) {
      throw sessionExpired();
    }

    const user = await this.authenticator.findActiveUser(payload.sub);
    if (!user) throw sessionExpired();
    const actor = await this.authenticator.findActiveActor(payload.sub);
    if (!actor) {
      throw new AppException({
        code: AppErrorCode.ActorProfileRequired,
        status: 403,
        message:
          'Your account is not fully configured for portal access. Contact your administrator.',
      });
    }
    RequestContext.setActorId(actor.id);
    request.user = user;
    request.actor = actor;
    request.authSessionId = payload.sid;
    return true;
  }
}

function authRequired(): AppException {
  return new AppException({
    code: AppErrorCode.AuthRequired,
    status: 401,
    message: 'You need to sign in to access this page.',
  });
}

function sessionExpired(): AppException {
  return new AppException({
    code: AppErrorCode.AuthSessionExpired,
    status: 401,
    message:
      'Your session has expired or is no longer valid. Sign in again to continue.',
  });
}

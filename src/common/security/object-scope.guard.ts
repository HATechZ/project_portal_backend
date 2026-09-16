import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import {
  ActorScopeContext,
  ObjectScopeProvider,
} from './object-scope.provider';
import { AuthenticationRequest } from './authentication.guard';
import { AppErrorCode } from '../exceptions/app-error-code';
import { AppException } from '../exceptions/app-exception';

export type ObjectScopeRequest = AuthenticationRequest & {
  actorScope?: ActorScopeContext;
};

@Injectable()
export class ObjectScopeGuard implements CanActivate {
  constructor(private readonly objectScopeProvider: ObjectScopeProvider) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<ObjectScopeRequest>();
    if (!request.actor) {
      throw new AppException({
        code: AppErrorCode.ActorProfileRequired,
        status: 401,
        message:
          'Your account is not fully configured for portal access. Contact your administrator.',
      });
    }
    request.actorScope = this.objectScopeProvider.resolve(request.actor);
    return true;
  }
}

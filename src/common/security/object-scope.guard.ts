import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ActorScopeContext,
  ObjectScopeProvider,
} from './object-scope.provider';
import { AuthenticationRequest } from './authentication.guard';

export type ObjectScopeRequest = AuthenticationRequest & {
  actorScope?: ActorScopeContext;
};

@Injectable()
export class ObjectScopeGuard implements CanActivate {
  constructor(private readonly objectScopeProvider: ObjectScopeProvider) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<ObjectScopeRequest>();
    if (!request.actor) {
      throw new UnauthorizedException('Active actor profile is required');
    }
    request.actorScope = this.objectScopeProvider.resolve(request.actor);
    return true;
  }
}

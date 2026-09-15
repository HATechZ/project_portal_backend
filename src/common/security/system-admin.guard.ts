import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ActorRoleCode } from '../../generated/prisma/client';
import { ALLOW_ACTOR_ROLES_KEY } from './allow-actor-roles.decorator';
import { SessionActor } from './session.types';

@Injectable()
export class SystemAdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const actor = context
      .switchToHttp()
      .getRequest<{ actor?: SessionActor }>().actor;
    const roleCode = actor?.role.code;
    if (roleCode === ActorRoleCode.system_admin) return true;

    // Opt-in only: absent metadata means system_admin alone, as before.
    const allowed =
      this.reflector.getAllAndOverride<ActorRoleCode[]>(ALLOW_ACTOR_ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (roleCode && allowed.includes(roleCode)) return true;

    throw new ForbiddenException('System administrator access required');
  }
}

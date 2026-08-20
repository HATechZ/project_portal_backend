import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ActorRoleCode,
  WorkflowActionCode,
} from '../../generated/prisma/client';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { SessionUser } from '../repositories';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<WorkflowActionCode[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const user = context
      .switchToHttp()
      .getRequest<{ user?: SessionUser }>().user;
    const roles = user?.userRolesByUserId.map(({ role }) => role) ?? [];
    if (roles.some(({ code }) => code === ActorRoleCode.system_admin))
      return true;

    const granted = new Set(
      roles.flatMap(({ workflowActionRolePermissionsByRoleId }) =>
        workflowActionRolePermissionsByRoleId.map(({ action }) => action.code),
      ),
    );
    if (!required.every((permission) => granted.has(permission))) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}

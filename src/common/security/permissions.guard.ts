import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkflowActionCode } from '../../generated/prisma/client';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { SessionActor } from './session.types';
import { AppErrorCode } from '../exceptions/app-error-code';
import { AppException } from '../exceptions/app-exception';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<WorkflowActionCode[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const actor = context
      .switchToHttp()
      .getRequest<{ actor?: SessionActor }>().actor;
    const granted = new Set(
      actor?.role.workflowActionRolePermissionsByRoleId.map(
        ({ action }) => action.code,
      ) ?? [],
    );
    if (!required.every((permission) => granted.has(permission))) {
      throw new AppException({
        code: AppErrorCode.Forbidden,
        status: 403,
        message:
          "You don't have permission to perform this action. Contact your administrator if you need access.",
      });
    }
    return true;
  }
}

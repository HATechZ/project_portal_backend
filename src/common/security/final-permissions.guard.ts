import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionCode } from '../../generated/prisma/client';
import { AppErrorCode } from '../exceptions/app-error-code';
import { AppException } from '../exceptions/app-exception';
import { FINAL_PERMISSIONS_KEY } from './final-permissions.decorator';
import {
  FinalAuthorizationCheck,
  FINAL_AUTHORIZATION_CHECKS_KEY,
} from './final-authorization-checks.decorator';
import { SessionActor } from './session.types';

/** Shared final-catalogue authorization. Resource/state checks remain feature-owned. */
@Injectable()
export class FinalPermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PermissionCode[]>(
      FINAL_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    const request = context
      .switchToHttp()
      .getRequest<{ actor?: SessionActor }>();
    const actor = request.actor;
    if (!required?.length) return true;
    if (!actor || !actor.isActive || !actor.role.isActive) {
      throw new AppException({
        code: AppErrorCode.Forbidden,
        status: 403,
        message: 'Active actor and role are required for authorization.',
      });
    }
    const granted = new Set(
      actor.role.rolePermissions
        .filter(({ revokedAt }) => revokedAt === null)
        .filter(
          ({ permission }) =>
            actor.role.customScope === null ||
            permission.scopeCompatibilities.some(
              ({ scope }) => scope === actor.role.customScope,
            ),
        )
        .map(({ permission }) => permission.code),
    );
    if (!required.every((code) => granted.has(code))) {
      throw new AppException({
        code: AppErrorCode.Forbidden,
        status: 403,
        message: 'Missing required explicit permission.',
      });
    }
    const checks = this.reflector.getAllAndOverride<FinalAuthorizationCheck[]>(
      FINAL_AUTHORIZATION_CHECKS_KEY,
      [context.getHandler(), context.getClass()],
    );
    for (const check of (checks ?? []).filter(
      (candidate): candidate is FinalAuthorizationCheck =>
        typeof candidate?.validate === 'function',
    )) {
      if (!(await check.validate(request, actor))) {
        throw new AppException({
          code: AppErrorCode.Forbidden,
          status: 403,
          message: `Authorization denied by ${check.kind} condition: ${check.reason}`,
        });
      }
    }
    return true;
  }
}

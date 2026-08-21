import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ActorRoleCode,
  WorkflowActionCode,
} from '../../generated/prisma/client';
import { PermissionsGuard } from './permissions.guard';

const contextFor = (roles: unknown[]): ExecutionContext =>
  ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user: { userRolesByUserId: roles } }),
    }),
  }) as unknown as ExecutionContext;

describe('PermissionsGuard', () => {
  it('allows a permission aggregated from the active user roles', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue([WorkflowActionCode.ADD_PROJECT]),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    const roles = [
      {
        role: {
          code: ActorRoleCode.division_lead,
          workflowActionRolePermissionsByRoleId: [
            {
              action: { code: WorkflowActionCode.ADD_PROJECT },
            },
          ],
        },
      },
    ];

    expect(guard.canActivate(contextFor(roles))).toBe(true);
  });

  it('allows a system administrator when the required permission is granted', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue([WorkflowActionCode.UPDATE_SETTINGS]),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    const roles = [
      {
        role: {
          code: ActorRoleCode.system_admin,
          workflowActionRolePermissionsByRoleId: [
            {
              action: { code: WorkflowActionCode.UPDATE_SETTINGS },
            },
          ],
        },
      },
    ];

    expect(guard.canActivate(contextFor(roles))).toBe(true);
  });

  it('rejects a system administrator without the required permission', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue([WorkflowActionCode.DECIDE_BID_OUTCOME]),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    const roles = [
      {
        role: {
          code: ActorRoleCode.system_admin,
          workflowActionRolePermissionsByRoleId: [],
        },
      },
    ];

    expect(() => guard.canActivate(contextFor(roles))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects users without every required permission', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue([WorkflowActionCode.ADD_PROJECT]),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    expect(() => guard.canActivate(contextFor([]))).toThrow(ForbiddenException);
  });
});

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, WorkflowActionCode } from '../../generated/prisma/client';
import { RequestContext } from '../../common/context/request-context';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';

import {
  permissionSelect,
  roleSelect,
  assignmentSelect,
  RoleRecord,
  PermissionRecord,
  UserRoleAssignment,
} from './role-permission.records';
export { assignmentSelect } from './role-permission.records';
export type {
  RoleRecord,
  PermissionRecord,
  UserRoleAssignment,
} from './role-permission.records';

@Injectable()
export class RolePermissionRepository extends BaseRepository {
  constructor(unitOfWork: UnitOfWorkService) {
    super(unitOfWork);
  }

  findRoles(): Promise<RoleRecord[]> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.role.findMany({
        where: { OR: [{ isSystemRole: true }, { tenantId }] },
        orderBy: { name: 'asc' },
        select: roleSelect(tenantId),
      }),
    );
  }

  findRole(id: string): Promise<RoleRecord | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.role.findFirst({
        where: { id, OR: [{ isSystemRole: true }, { tenantId }] },
        select: roleSelect(tenantId),
      }),
    );
  }

  findPermissions(): Promise<PermissionRecord[]> {
    return this.transaction((db) =>
      db.workflowActionDefinition.findMany({
        orderBy: { code: 'asc' },
        select: permissionSelect,
      }),
    );
  }

  findVisiblePermissions(): Promise<PermissionRecord[]> {
    return this.transaction((db) =>
      db.workflowActionDefinition.findMany({
        where: { isUserVisible: true },
        orderBy: { code: 'asc' },
        select: permissionSelect,
      }),
    );
  }

  findPermission(id: string): Promise<PermissionRecord | null> {
    return this.transaction((db) =>
      db.workflowActionDefinition.findUnique({
        where: { id },
        select: permissionSelect,
      }),
    );
  }

  async replaceRolePermissions(
    roleId: string,
    permissionCodes: WorkflowActionCode[],
  ): Promise<RoleRecord> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(
      async (transaction) => {
        const actions = await transaction.workflowActionDefinition.findMany({
          where: { code: { in: permissionCodes } },
          select: { id: true },
        });
        await transaction.workflowActionRolePermission.updateMany({
          where: { tenantId, roleId },
          data: { allowed: false },
        });
        for (const action of actions) {
          await transaction.workflowActionRolePermission.upsert({
            where: {
              tenantId_actionId_roleId: {
                tenantId,
                actionId: action.id,
                roleId,
              },
            },
            create: {
              id: randomUUID(),
              tenantId,
              roleId,
              actionId: action.id,
              allowed: true,
            },
            update: { allowed: true },
          });
        }
        return transaction.role.findFirstOrThrow({
          where: { id: roleId, OR: [{ isSystemRole: true }, { tenantId }] },
          select: roleSelect(tenantId),
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  findUser(id: string): Promise<{ id: string } | null> {
    return this.transaction((db) =>
      db.user.findUnique({ where: { id }, select: { id: true } }),
    );
  }

  findUserRoles(
    userId: string,
    includeRevoked = false,
  ): Promise<UserRoleAssignment[]> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.userRole.findMany({
        where: { userId, ...(includeRevoked ? {} : { revokedAt: null }) },
        orderBy: { assignedAt: 'desc' },
        select: assignmentSelect(tenantId),
      }),
    );
  }

  findActiveAssignment(
    userId: string,
    roleId: string,
  ): Promise<UserRoleAssignment | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.userRole.findFirst({
        where: { userId, roleId, revokedAt: null },
        select: assignmentSelect(tenantId),
      }),
    );
  }

  revokeAssignment(
    id: string,
    roleId: string,
    preserveLastAssignment: boolean,
  ): Promise<boolean> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(
      async (transaction) => {
        if (preserveLastAssignment) {
          const activeAssignments = await transaction.userRole.count({
            where: {
              tenantId,
              roleId,
              revokedAt: null,
              user: { isActive: true },
            },
          });
          if (activeAssignments <= 1) return false;
        }

        await transaction.userRole.update({
          where: { id, tenantId },
          data: { revokedAt: new Date() },
        });
        return true;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}

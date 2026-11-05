import { findAffectedScopeBindings } from './role-scope-bindings';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, CustomRoleScope } from '../../generated/prisma/client';
import { RequestContext } from '../../common/context/request-context';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import { reconcileActingProfileSelection } from '../../common/security/actor-access-orchestration';

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

  withRoleMutation<T>(work: () => Promise<T>): Promise<T> {
    return this.transaction(() => work(), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  async findAffectedScopeBindings(roleId: string, scope: CustomRoleScope) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      return findAffectedScopeBindings(db, tenantId, roleId, scope);
    });
  }

  findRoles(): Promise<RoleRecord[]> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.role.findMany({
        where: { isActive: true, OR: [{ isSystemRole: true }, { tenantId }] },
        orderBy: { name: 'asc' },
        select: roleSelect(tenantId),
      }),
    );
  }

  findRole(id: string): Promise<RoleRecord | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.role.findFirst({
        where: {
          id,
          isActive: true,
          OR: [{ isSystemRole: true }, { tenantId }],
        },
        select: roleSelect(tenantId),
      }),
    );
  }

  findPermissions(): Promise<PermissionRecord[]> {
    return this.transaction((db) =>
      db.permission.findMany({
        orderBy: { code: 'asc' },
        select: permissionSelect,
      }),
    );
  }

  findVisiblePermissions(): Promise<PermissionRecord[]> {
    return this.transaction((db) =>
      db.permission.findMany({
        orderBy: { code: 'asc' },
        select: permissionSelect,
      }),
    );
  }

  findPermissionsByIds(ids: string[]): Promise<PermissionRecord[]> {
    return this.transaction((db) =>
      db.permission.findMany({
        where: { id: { in: ids } },
        select: permissionSelect,
      }),
    );
  }

  findPermissionDependencyGraph() {
    return this.transaction((db) =>
      db.permission.findMany({
        select: {
          id: true,
          scopeCompatibilities: { select: { scope: true } },
          requiredPermissionDependencies: {
            select: { requiredPermissionId: true },
          },
        },
      }),
    );
  }

  findPermission(id: string): Promise<PermissionRecord | null> {
    return this.transaction((db) =>
      db.permission.findUnique({
        where: { id },
        select: permissionSelect,
      }),
    );
  }

  async replaceRolePermissions(
    roleId: string,
    permissionIds: string[],
    customScope?: CustomRoleScope,
  ): Promise<RoleRecord> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(
      async (transaction) => {
        const permissions = await transaction.permission.findMany({
          where: { id: { in: permissionIds } },
          select: { id: true },
        });

        const grants = await transaction.rolePermission.findMany({
          where: { tenantId, roleId },
          orderBy: { grantedAt: 'asc' },
          select: { id: true, permissionId: true, revokedAt: true },
        });
        const requestedIds = new Set(permissions.map(({ id }) => id));
        const activeGrants = grants.filter(
          ({ revokedAt }) => revokedAt === null,
        );
        const activePermissionIds = new Set(
          activeGrants.map(({ permissionId }) => permissionId),
        );
        const grantsToRevoke = activeGrants
          .filter(({ permissionId }) => !requestedIds.has(permissionId))
          .map(({ id }) => id);

        if (grantsToRevoke.length > 0) {
          await transaction.rolePermission.updateMany({
            where: { id: { in: grantsToRevoke } },
            data: { revokedAt: new Date() },
          });
        }

        // Revoke removed grants while the role still has their original scope.
        // The tenant extension writes tenantId on updates, firing the immediate
        // role_permissions_role_tenant_match trigger even for revokedAt changes.
        if (customScope) {
          await transaction.role.updateMany({
            where: { id: roleId, tenantId, isSystemRole: false },
            data: { customScope },
          });
        }

        for (const permission of permissions) {
          if (activePermissionIds.has(permission.id)) continue;
          const revokedGrant = grants.find(
            ({ permissionId, revokedAt }) =>
              permissionId === permission.id && revokedAt !== null,
          );
          if (revokedGrant) {
            await transaction.rolePermission.update({
              where: { id: revokedGrant.id },
              data: { revokedAt: null },
            });
            continue;
          }
          await transaction.rolePermission.create({
            data: {
              id: randomUUID(),
              tenantId,
              roleId,
              permissionId: permission.id,
            },
          });
        }
        return transaction.role.findFirstOrThrow({
          where: {
            id: roleId,
            isActive: true,
            OR: [{ isSystemRole: true }, { tenantId }],
          },
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
        where: {
          tenantId,
          userId,
          ...(includeRevoked ? {} : { revokedAt: null }),
        },
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
        where: { tenantId, userId, roleId, revokedAt: null },
        select: assignmentSelect(tenantId),
      }),
    );
  }

  revokeAssignment(
    id: string,
    userId: string,
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
        await reconcileActingProfileSelection(transaction, {
          tenantId,
          userId,
        });
        return true;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}

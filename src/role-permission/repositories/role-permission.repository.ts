import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, WorkflowActionCode } from '../../generated/prisma/client';
import { RequestContext } from '../../common/context/request-context';
import { PrismaService } from '../../infra/prisma/prisma.service';

const permissionSelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  isUserVisible: true,
  isRevisionAction: true,
  isInfoRequestAction: true,
  isAssignmentAction: true,
  isTerminalAction: true,
} satisfies Prisma.WorkflowActionDefinitionSelect;

const roleSelect = (tenantId: string) =>
  ({
    id: true,
    code: true,
    name: true,
    description: true,
    isSystemRole: true,
    createdAt: true,
    workflowActionRolePermissionsByRoleId: {
      where: { tenantId, allowed: true },
      orderBy: { action: { code: 'asc' as const } },
      select: { action: { select: permissionSelect } },
    },
  }) satisfies Prisma.RoleSelect;

const assignmentSelect = (tenantId: string) =>
  ({
    id: true,
    userId: true,
    roleId: true,
    assignedByUserId: true,
    assignedAt: true,
    revokedAt: true,
    role: { select: roleSelect(tenantId) },
  }) satisfies Prisma.UserRoleSelect;

export type RoleRecord = Prisma.RoleGetPayload<{
  select: ReturnType<typeof roleSelect>;
}>;
export type PermissionRecord = Prisma.WorkflowActionDefinitionGetPayload<{
  select: typeof permissionSelect;
}>;
export type UserRoleAssignment = Prisma.UserRoleGetPayload<{
  select: ReturnType<typeof assignmentSelect>;
}>;

@Injectable()
export class RolePermissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findRoles(): Promise<RoleRecord[]> {
    const tenantId = RequestContext.requireTenantId();
    return this.prisma.role.findMany({
      orderBy: { name: 'asc' },
      select: roleSelect(tenantId),
    });
  }

  findRole(id: string): Promise<RoleRecord | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.prisma.role.findUnique({
      where: { id },
      select: roleSelect(tenantId),
    });
  }

  findPermissions(): Promise<PermissionRecord[]> {
    return this.prisma.workflowActionDefinition.findMany({
      orderBy: { code: 'asc' },
      select: permissionSelect,
    });
  }

  findVisiblePermissions(): Promise<PermissionRecord[]> {
    return this.prisma.workflowActionDefinition.findMany({
      where: { isUserVisible: true },
      orderBy: { code: 'asc' },
      select: permissionSelect,
    });
  }

  findPermission(id: string): Promise<PermissionRecord | null> {
    return this.prisma.workflowActionDefinition.findUnique({
      where: { id },
      select: permissionSelect,
    });
  }

  async replaceRolePermissions(
    roleId: string,
    permissionCodes: WorkflowActionCode[],
  ): Promise<RoleRecord> {
    const tenantId = RequestContext.requireTenantId();
    await this.prisma.$transaction(async (transaction) => {
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
            tenantId_actionId_roleId: { tenantId, actionId: action.id, roleId },
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
    });
    return this.prisma.role.findUniqueOrThrow({
      where: { id: roleId },
      select: roleSelect(tenantId),
    });
  }

  findUser(id: string): Promise<{ id: string } | null> {
    return this.prisma.scoped.user.findUnique({
      where: { id },
      select: { id: true },
    });
  }

  findUserRoles(
    userId: string,
    includeRevoked = false,
  ): Promise<UserRoleAssignment[]> {
    const tenantId = RequestContext.requireTenantId();
    return this.prisma.scoped.userRole.findMany({
      where: { userId, ...(includeRevoked ? {} : { revokedAt: null }) },
      orderBy: { assignedAt: 'desc' },
      select: assignmentSelect(tenantId),
    });
  }

  findActiveAssignment(
    userId: string,
    roleId: string,
  ): Promise<UserRoleAssignment | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.prisma.scoped.userRole.findFirst({
      where: { userId, roleId, revokedAt: null },
      select: assignmentSelect(tenantId),
    });
  }

  createAssignment(
    userId: string,
    roleId: string,
    assignedByUserId: string,
  ): Promise<UserRoleAssignment> {
    const tenantId = RequestContext.requireTenantId();
    return this.prisma.scoped.userRole.create({
      data: {
        id: randomUUID(),
        userId,
        roleId,
        assignedByUserId,
      } as Prisma.UserRoleUncheckedCreateInput,
      select: assignmentSelect(tenantId),
    });
  }

  revokeAssignment(
    id: string,
    roleId: string,
    preserveLastAssignment: boolean,
  ): Promise<boolean> {
    const tenantId = RequestContext.requireTenantId();
    return this.prisma.$transaction(
      async (transaction) => {
        if (preserveLastAssignment) {
          const activeAssignments = await transaction.userRole.count({
            where: { tenantId, roleId, revokedAt: null },
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

import { Prisma } from '../../generated/prisma/client';

export const permissionSelect = {
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

export const roleSelect = (tenantId: string) =>
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

export const assignmentSelect = (tenantId: string) =>
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

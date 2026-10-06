import { Prisma } from '../../generated/prisma/client';

export const permissionSelect = {
  id: true,
  code: true,
  displayName: true,
  description: true,
  category: true,
  actionType: true,
  resource: true,
  scopeCompatibilities: { select: { scope: true } },
} satisfies Prisma.PermissionSelect;

export const roleSelect = (tenantId: string) =>
  ({
    id: true,
    tenantId: true,
    customCode: true,
    customScope: true,
    systemRole: { select: { systemCode: true } },
    name: true,
    description: true,
    isSystemRole: true,
    createdAt: true,
    rolePermissions: {
      where: { tenantId, revokedAt: null },
      orderBy: { permission: { code: 'asc' as const } },
      select: { permission: { select: permissionSelect } },
    },
  }) satisfies Prisma.RoleSelect;

export const assignmentSelect = (tenantId: string) =>
  ({
    id: true,
    userId: true,
    roleId: true,
    teamId: true,
    assignedByUserId: true,
    assignedAt: true,
    revokedAt: true,
    role: { select: roleSelect(tenantId) },
  }) satisfies Prisma.UserRoleSelect;

export type RoleRecord = Prisma.RoleGetPayload<{
  select: ReturnType<typeof roleSelect>;
}>;
export type PermissionRecord = Prisma.PermissionGetPayload<{
  select: typeof permissionSelect;
}>;
export type UserRoleAssignment = Prisma.UserRoleGetPayload<{
  select: ReturnType<typeof assignmentSelect>;
}>;

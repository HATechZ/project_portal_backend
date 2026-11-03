import { ROLE_IDS } from '../data/roles.data';
import { Seeder } from '../types';
import { randomUUID } from 'node:crypto';
import {
  PermissionCode,
  PrismaClient,
  WorkflowActionCode,
} from '../../../src/generated/prisma/client';

const tenantSuperAdminWorkRequestActions = [
  WorkflowActionCode.ADD_WORK_REQUEST,
  WorkflowActionCode.ADD_WORK_REQUEST_DOCUMENT,
  WorkflowActionCode.ADD_WORK_REQUEST_NOTE,
  WorkflowActionCode.REQUEST_WORKFLOW_INFO,
  WorkflowActionCode.RESPOND_WORKFLOW_INFO,
  WorkflowActionCode.VIEW_WORK_REQUEST,
  WorkflowActionCode.UPDATE_WORK_REQUEST,
] as const;

export async function initializeTenantPermissions(
  prisma: PrismaClient,
  tenantId: string,
): Promise<void> {
  const roleId = ROLE_IDS.tenant_super_admin;
  const permissions = await prisma.permission.findMany({
    // The database trigger allows the tenant super administrator every
    // catalogue permission except the Client-contact final-delivery actions.
    // Keep this seed aligned with that invariant so the seed remains
    // idempotent after the client-only permissions were added.
    where: {
      code: {
        notIn: [
          PermissionCode.ACCEPT_FINAL_DELIVERY,
          PermissionCode.REJECT_FINAL_DELIVERY,
          PermissionCode.REQUEST_REVISION,
        ],
      },
    },
    select: { id: true },
  });
  for (const permission of permissions) {
    const existing = await prisma.rolePermission.findFirst({
      where: { tenantId, roleId, permissionId: permission.id },
      select: { id: true },
    });
    if (existing) {
      await prisma.rolePermission.update({
        where: { id: existing.id },
        data: { revokedAt: null },
      });
    } else {
      await prisma.rolePermission.create({
        data: { id: randomUUID(), tenantId, roleId, permissionId: permission.id },
      });
    }
  }

  // The historical grant migration cannot see the development tenant because
  // seed creates it after migrations. Grant that migration's seven approved
  // Work Request actions here, without broadening the administrator's action
  // bundle to unrelated workflow actions.
  const actions = await prisma.workflowActionDefinition.findMany({
    where: { code: { in: [...tenantSuperAdminWorkRequestActions] } },
    select: { id: true },
  });
  for (const action of actions) {
    await prisma.workflowActionRolePermission.upsert({
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
        actionId: action.id,
        roleId,
        allowed: true,
      },
      update: { allowed: true },
    });
  }
}

export const permissionsSeeder: Seeder = {
  name: 'permissions and role grants',
  async run({ prisma, admin }) {
    await initializeTenantPermissions(prisma, admin.tenantId);
  },
};

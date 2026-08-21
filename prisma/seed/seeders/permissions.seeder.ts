import { ROLE_IDS } from '../data/roles.data';
import { permissions, rolePermissionCodes } from '../data/permissions.data';
import { Seeder } from '../types';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../../../src/generated/prisma/client';

export async function initializeTenantPermissions(
  prisma: PrismaClient,
  tenantId: string,
): Promise<void> {
  const actionIds = new Map<string, string>();
  for (const permission of permissions) {
    const { id, code, ...values } = permission;
    const action = await prisma.workflowActionDefinition.upsert({
      where: { code },
      create: { id, code, ...values },
      update: values,
    });
    actionIds.set(code, action.id);
  }

  for (const [roleCode, grantedCodes] of Object.entries(rolePermissionCodes)) {
    const roleId = ROLE_IDS[roleCode as keyof typeof ROLE_IDS];
    const granted = new Set(grantedCodes);
    for (const permission of permissions) {
      const actionId = actionIds.get(permission.code);
      if (!actionId)
        throw new Error(`Missing action ID for ${permission.code}`);
      await prisma.workflowActionRolePermission.upsert({
        where: {
          tenantId_actionId_roleId: { tenantId, actionId, roleId },
        },
        create: {
          id: randomUUID(),
          tenantId,
          actionId,
          roleId,
          allowed: granted.has(permission.code),
        },
        update: {},
      });
    }
  }
}

export const permissionsSeeder: Seeder = {
  name: 'permissions and role grants',
  async run({ prisma, admin }) {
    await initializeTenantPermissions(prisma, admin.tenantId);
  },
};

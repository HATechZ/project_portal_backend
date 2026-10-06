import { ROLE_IDS } from '../data/roles.data';
import { Seeder } from '../types';
import { randomUUID } from 'node:crypto';
import { PermissionCode, PrismaClient } from '../../../src/generated/prisma/client';

export async function initializeTenantPermissions(
  prisma: PrismaClient,
  tenantId: string,
): Promise<void> {
  const roleId = ROLE_IDS.tenant_super_admin;
  const permissions = await prisma.permission.findMany({
    where: { code: { not: PermissionCode.DECIDE_BID_OUTCOME } },
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
}

export const permissionsSeeder: Seeder = {
  name: 'permissions and role grants',
  async run({ prisma, admin }) {
    await initializeTenantPermissions(prisma, admin.tenantId);
  },
};

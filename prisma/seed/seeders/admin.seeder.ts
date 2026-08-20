import { hash } from 'bcryptjs';
import { ActorRoleCode } from '../../../src/generated/prisma/client';
import { ADMIN_IDS } from '../data/admin.data';
import { Seeder } from '../types';

export const adminSeeder: Seeder = {
  name: 'initial administrator',
  async run({ prisma, admin }) {
    const passwordHash = await hash(admin.password, 12);
    const user = await prisma.user.upsert({
      where: {
        tenantId_email: { tenantId: admin.tenantId, email: admin.email },
      },
      create: {
        id: ADMIN_IDS.user,
        tenantId: admin.tenantId,
        email: admin.email,
        fullName: admin.fullName,
        passwordHash,
        isActive: true,
      },
      update: {
        fullName: admin.fullName,
        passwordHash,
        isActive: true,
        updatedAt: new Date(),
      },
    });

    const role = await prisma.role.findUniqueOrThrow({
      where: { code: ActorRoleCode.system_admin },
    });
    const roleId = role.id;
    await prisma.userRole.upsert({
      where: { id: ADMIN_IDS.userRole },
      create: {
        id: ADMIN_IDS.userRole,
        tenantId: admin.tenantId,
        userId: user.id,
        roleId,
        assignedByUserId: user.id,
      },
      update: {
        tenantId: admin.tenantId,
        userId: user.id,
        roleId,
        revokedAt: null,
      },
    });
    await prisma.actorProfile.upsert({
      where: { id: ADMIN_IDS.actorProfile },
      create: {
        id: ADMIN_IDS.actorProfile,
        tenantId: admin.tenantId,
        userId: user.id,
        roleId,
        label: admin.fullName,
        isDefault: true,
        isActive: true,
      },
      update: {
        tenantId: admin.tenantId,
        userId: user.id,
        roleId,
        label: admin.fullName,
        isDefault: true,
        isActive: true,
      },
    });
  },
};

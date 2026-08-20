import { hash } from 'bcryptjs';
import { ActorRoleCode } from '../../../src/generated/prisma/client';
import { ADMIN_IDS } from '../data/admin.data';
import { Seeder } from '../types';

export const adminSeeder: Seeder = {
  name: 'initial administrator',
  async run({ prisma, admin }) {
    const passwordHash = await hash(admin.password, 12);
    const user = await prisma.user.upsert({
      where: { email: admin.email },
      create: {
        id: ADMIN_IDS.user,
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
        userId: user.id,
        roleId,
        assignedByUserId: user.id,
      },
      update: { userId: user.id, roleId, revokedAt: null },
    });
    await prisma.actorProfile.upsert({
      where: { id: ADMIN_IDS.actorProfile },
      create: {
        id: ADMIN_IDS.actorProfile,
        userId: user.id,
        roleId,
        label: admin.fullName,
        isDefault: true,
        isActive: true,
      },
      update: {
        userId: user.id,
        roleId,
        label: admin.fullName,
        isDefault: true,
        isActive: true,
      },
    });
  },
};

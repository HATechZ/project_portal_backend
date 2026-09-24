import { hash } from 'bcryptjs';
import { ActorRoleCode } from '../../../src/generated/prisma/client';
import { ADMIN_IDS } from '../data/admin.data';
import { Seeder } from '../types';

export const adminSeeder: Seeder = {
  name: 'initial administrator',
  async run({ prisma, admin }) {
    const email = admin.email.trim().toLowerCase();
    const passwordHash = await hash(admin.password, 12);
    const existingById = await prisma.user.findUnique({
      where: { id: ADMIN_IDS.user },
    });
    const existingByEmail = await prisma.user.findUnique({ where: { email } });

    if (
      existingById &&
      existingByEmail &&
      existingById.id !== existingByEmail.id
    ) {
      throw new Error(
        'Initial administrator ID and email belong to different users',
      );
    }

    const existing = existingById ?? existingByEmail;
    if (existing && existing.tenantId !== admin.tenantId) {
      throw new Error(
        'Initial administrator ID or email belongs to a different tenant',
      );
    }
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            email,
            fullName: admin.fullName,
            passwordHash,
            isActive: true,
            updatedAt: new Date(),
          },
        })
      : await prisma.user.create({
          data: {
            id: ADMIN_IDS.user,
            tenantId: admin.tenantId,
            email,
            fullName: admin.fullName,
            passwordHash,
            isActive: true,
          },
        });

    const systemRole = await prisma.systemRole.findUniqueOrThrow({
      where: { systemCode: ActorRoleCode.system_admin },
    });
    const roleId = systemRole.roleId;
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

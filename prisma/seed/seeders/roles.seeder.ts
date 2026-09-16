import { ROLE_IDS, roles } from '../data/roles.data';
import { Seeder } from '../types';

export const rolesSeeder: Seeder = {
  name: 'roles',
  async run({ prisma }) {
    for (const role of roles) {
      await prisma.$transaction(async (tx) => {
        const roleDefinition = await tx.role.upsert({
          where: { id: ROLE_IDS[role.systemCode] },
          create: {
            id: ROLE_IDS[role.systemCode],
            name: role.name,
            description: role.description,
            isSystemRole: true,
          },
          update: {
            name: role.name,
            description: role.description,
            isSystemRole: true,
          },
        });
        await tx.systemRole.upsert({
          where: { systemCode: role.systemCode },
          create: { roleId: roleDefinition.id, systemCode: role.systemCode },
          update: { roleId: roleDefinition.id },
        });
      });
    }
  },
};

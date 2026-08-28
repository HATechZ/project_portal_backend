import { ROLE_IDS, roles } from '../data/roles.data';
import { Seeder } from '../types';

export const rolesSeeder: Seeder = {
  name: 'roles',
  async run({ prisma }) {
    for (const role of roles) {
      await prisma.role.upsert({
        where: { code: role.code },
        create: { id: ROLE_IDS[role.code], ...role, isSystemRole: true },
        update: { ...role, isSystemRole: true },
      });
    }
  },
};

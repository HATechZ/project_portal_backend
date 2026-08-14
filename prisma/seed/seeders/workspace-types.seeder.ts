import { workspaceTypes } from '../data/workspace-types.data';
import { Seeder } from '../types';

export const workspaceTypesSeeder: Seeder = {
  name: 'workspace types',
  async run({ prisma }) {
    for (const item of workspaceTypes) {
      await prisma.workspaceType.upsert({
        where: { code: item.code },
        create: item,
        update: { name: item.name },
      });
    }
  },
};

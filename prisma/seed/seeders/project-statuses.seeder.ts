import { projectStatuses } from '../data/project-statuses.data';
import { Seeder } from '../types';

export const projectStatusesSeeder: Seeder = {
  name: 'project statuses',
  async run({ prisma }) {
    for (const status of projectStatuses) {
      const { id, code, ...values } = status;
      await prisma.projectStatus.upsert({
        where: { code },
        create: { id, code, ...values },
        update: values,
      });
    }
  },
};

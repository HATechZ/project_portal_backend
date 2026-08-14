import { workflowStatuses } from '../data/workflow-statuses.data';
import { Seeder } from '../types';

export const workflowStatusesSeeder: Seeder = {
  name: 'workflow statuses',
  async run({ prisma }) {
    for (const status of workflowStatuses) {
      const { id, code, ...values } = status;
      await prisma.workflowStatus.upsert({
        where: { code },
        create: { id, code, ...values },
        update: values,
      });
    }
  },
};

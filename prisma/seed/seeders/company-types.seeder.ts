import { companyTypes } from '../data/company-types.data';
import { Seeder } from '../types';

export const companyTypesSeeder: Seeder = {
  name: 'company types',
  async run({ prisma }) {
    for (const companyType of companyTypes) {
      await prisma.companyType.upsert({
        where: { id: companyType.id },
        create: companyType,
        update: {
          name: companyType.name,
          description: companyType.description,
        },
      });
    }
  },
};

import { defaultTenant } from '../data/tenants.data';
import { Seeder } from '../types';

export const tenantSeeder: Seeder = {
  name: 'default tenant',
  async run({ prisma }) {
    await prisma.tenant.upsert({
      where: { id: defaultTenant.id },
      create: defaultTenant,
      update: {
        name: defaultTenant.name,
        slug: defaultTenant.slug,
        isActive: true,
        updatedAt: new Date(),
      },
    });
  },
};

import { defaultTenant } from '../data/tenants.data';
import { Seeder } from '../types';

export const tenantSeeder: Seeder = {
  name: 'default tenant',
  async run({ prisma, admin }) {
    await prisma.tenant.upsert({
      // All tenant-scoped seed records use admin.tenantId.  Honour an
      // explicit SEED_TENANT_ID here as well; otherwise the later role-grant
      // seed attempts to reference a tenant that this seeder never created.
      where: { id: admin.tenantId },
      create: { ...defaultTenant, id: admin.tenantId },
      update: {
        name: defaultTenant.name,
        slug: defaultTenant.slug,
        isActive: true,
        updatedAt: new Date(),
      },
    });
  },
};

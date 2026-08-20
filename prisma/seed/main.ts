import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import { adminSeeder } from './seeders/admin.seeder';
import { projectStatusesSeeder } from './seeders/project-statuses.seeder';
import { rolesSeeder } from './seeders/roles.seeder';
import { workflowStatusesSeeder } from './seeders/workflow-statuses.seeder';
import { workspaceTypesSeeder } from './seeders/workspace-types.seeder';
import { Seeder } from './types';
import { tenantSeeder } from './seeders/tenant.seeder';
import { DEFAULT_TENANT_ID } from './data/tenants.data';

const seeders: Seeder[] = [
  tenantSeeder,
  rolesSeeder,
  workspaceTypesSeeder,
  projectStatusesSeeder,
  workflowStatusesSeeder,
  adminSeeder,
];

function adminConfig() {
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'admin123';
  if (password.length < 6 || password.length > 8) {
    throw new Error(
      'SEED_ADMIN_PASSWORD must contain between 6 and 8 characters',
    );
  }
  return {
    email: process.env.SEED_ADMIN_EMAIL ?? 'admin@project-portal.local',
    fullName: process.env.SEED_ADMIN_FULL_NAME ?? 'System Administrator',
    password,
    tenantId: process.env.SEED_TENANT_ID ?? DEFAULT_TENANT_ID,
  };
}

export async function runSeed(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error('DATABASE_URL is required to seed the database');

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  try {
    const context = { prisma, admin: adminConfig() };
    for (const seeder of seeders) {
      console.log(`Seeding ${seeder.name}...`);
      await seeder.run(context);
    }
    console.log('Database seeding completed');
  } finally {
    await prisma.$disconnect();
  }
}

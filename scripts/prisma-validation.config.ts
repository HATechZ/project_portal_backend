import { defineConfig, env } from 'prisma/config';

const migrationsPath = process.env.PRISMA_VALIDATION_MIGRATIONS_PATH;

if (!migrationsPath) {
  throw new Error('PRISMA_VALIDATION_MIGRATIONS_PATH is required for disposable validation.');
}

export default defineConfig({
  schema: '../prisma/schema.prisma',
  migrations: { path: migrationsPath },
  datasource: { url: env('DATABASE_URL_MIGRATION') },
});

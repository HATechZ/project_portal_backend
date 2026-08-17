export const DEFAULT_TENANT_ID = '00000000-0000-4000-8000-000000000001';

export const defaultTenant = {
  id: DEFAULT_TENANT_ID,
  name: process.env.SEED_TENANT_NAME ?? 'Default Organization',
  slug: process.env.SEED_TENANT_SLUG ?? 'default',
} as const;

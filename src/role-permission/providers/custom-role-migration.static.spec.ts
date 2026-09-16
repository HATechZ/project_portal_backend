import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('custom access role migration contract', () => {
  const sql = readFileSync(
    resolve(
      'prisma/migrations/20260916000000_add_custom_access_roles/migration.sql',
    ),
    'utf8',
  );

  it('backfills system identities and protects fixed workflow references', () => {
    expect(sql).toContain(
      'INSERT INTO public.system_roles (role_id, system_code)',
    );
    expect(sql).toContain('REFERENCES public.system_roles(role_id)');
    expect(sql).toContain(
      'CREATE UNIQUE INDEX roles_tenant_id_custom_code_key',
    );
  });

  it('does not delete or truncate business data', () => {
    expect(sql).not.toMatch(/\b(?:DELETE\s+FROM|TRUNCATE|DROP\s+TABLE)\b/i);
  });
});

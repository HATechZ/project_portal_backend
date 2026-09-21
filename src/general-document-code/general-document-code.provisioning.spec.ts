import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260921000001_provision_general_document_codes/migration.sql',
  ),
  'utf8',
);

describe('General Document Code provisioning migration', () => {
  it('backfills only missing initial codes and grants narrow runtime access', () => {
    for (const code of [
      '000',
      '001',
      '002',
      '011',
      '012',
      '013',
      '802',
      '803',
    ]) {
      expect(migration).toContain(`('${code}',`);
    }
    expect(migration).toContain(
      'ON CONFLICT (tenant_id, document_group, code) DO NOTHING',
    );
    expect(migration).toContain(
      'GRANT SELECT, INSERT, UPDATE ON TABLE public.document_code_options TO app_user',
    );
    expect(migration).not.toMatch(
      /GRANT\s+(?:ALL|DELETE).*document_code_options/i,
    );
  });

  it('initializes the approved new-tenant catalogue and role grants only', () => {
    expect(migration).toContain("'MANAGE_GENERAL_DOCUMENT_CODES'");
    expect(migration).toContain("'system_admin'::public.actor_role_code");
    expect(migration).toContain("'division_head'::public.actor_role_code");
    expect(migration).toContain("'division_lead'::public.actor_role_code");
    expect(migration).toContain(
      'ON CONFLICT (tenant_id, document_group, code) DO NOTHING',
    );
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260924000001_provision_marketing_document_codes/migration.sql',
  ),
  'utf8',
);

describe('Marketing Document Code provisioning migration', () => {
  it('backfills only missing initial codes and grants narrow runtime access', () => {
    for (const code of ['801', '802', '803']) {
      expect(migration).toContain(`('${code}',`);
    }
    expect(migration).toContain(
      'ON CONFLICT (tenant_id, document_group, code) DO NOTHING',
    );
    expect(migration).toContain("'MARKETING'::public.document_group_code");
    expect(migration).not.toMatch(
      /GRANT\s+(?:ALL|DELETE).*document_code_options/i,
    );
  });

  it('preserves legacy 802/803 identities while moving the remaining legacy catalogue to General', () => {
    expect(migration).toContain("code NOT IN ('802', '803')");
    expect(migration).toContain("'GENERAL'::public.document_group_code");
    expect(migration).toContain(
      'ON CONFLICT (tenant_id, document_group, code) DO NOTHING',
    );
  });
});

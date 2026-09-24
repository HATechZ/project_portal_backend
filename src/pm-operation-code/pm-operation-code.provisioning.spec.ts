import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260924000004_provision_pm_operation_document_codes/migration.sql',
  ),
  'utf8',
);

describe('PM & Operation Document Code provisioning migration', () => {
  it('provisions the PM & Operation starter catalogue idempotently', () => {
    for (const [code, name] of [
      ['601', 'Method Statement'],
      ['602', 'Voyage & Weather Routing Plan'],
      ['603', 'HSEQ Management Plan'],
      ['604', 'Safe Working Plan'],
      ['605', 'Emergency Response Plan'],
      ['606', 'Anti-Piracy Plan'],
      ['607', 'Crew Management Plan'],
      ['608', 'Vessel Maintenance Plan'],
    ]) {
      expect(migration).toContain(`('${code}', '${name}'`);
    }
    expect(migration).toContain(
      'ON CONFLICT (tenant_id, document_group, code) DO NOTHING',
    );
    expect(migration).toContain("'PROJECT_MANAGEMENT_OPERATION'::public.document_group_code");
  });
});


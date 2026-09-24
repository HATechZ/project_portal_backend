import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260924000002_provision_etc_document_codes/migration.sql',
  ),
  'utf8',
);

describe('ETC Document Code provisioning migration', () => {
  it('provisions only the ETC starter catalogue idempotently', () => {
    for (const [code, name] of [
      ['901', 'Lesson and Learnt'],
      ['902', 'Picture'],
      ['999', 'Backup'],
    ]) {
      expect(migration).toContain(`('${code}', '${name}'`);
    }
    expect(migration).toContain(
      'ON CONFLICT (tenant_id, document_group, code) DO NOTHING',
    );
    expect(migration).toContain("'ETC'::public.document_group_code");
  });
});

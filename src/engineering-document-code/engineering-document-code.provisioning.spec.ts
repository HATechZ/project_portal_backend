import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260924000003_provision_engineering_document_codes/migration.sql',
  ),
  'utf8',
);

const starterCodes = [
  '100',
  '101',
  '110',
  '130',
  '200',
  '211',
  '212',
  '221',
  '222',
  '231',
  '232',
  '250',
  '301',
  '302',
  '341',
  '342',
  '351',
  '352',
  '361',
  '362',
  '371',
  '372',
  '400',
  '410',
  '411',
  '412',
  '420',
  '430',
  '440',
];

describe('Engineering Document Code provisioning migration', () => {
  it('provisions all 29 starter records individually and idempotently', () => {
    expect(new Set(starterCodes).size).toBe(29);
    for (const code of starterCodes) expect(migration).toContain(`('${code}',`);
    expect(migration).toContain("'ENGINEERING'::public.document_group_code");
    expect(migration).toContain(
      'ON CONFLICT (tenant_id, document_group, code) DO NOTHING',
    );
  });

  it('keeps paired codes as separate Engineering records', () => {
    for (const [first, second] of [
      ['211', '212'],
      ['221', '222'],
      ['231', '232'],
      ['301', '302'],
      ['341', '342'],
      ['351', '352'],
      ['361', '362'],
      ['371', '372'],
    ]) {
      expect(migration).toContain(`('${first}',`);
      expect(migration).toContain(`('${second}',`);
    }
  });
});

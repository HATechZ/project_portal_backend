/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RequestContext } from '../../common/context/request-context';
import { OptionTypeCode } from '../../generated/prisma/client';
import { CargoCodeRepository } from '../../cargo-code/repositories/cargo-code.repository';
import { PodCodeRepository } from '../../pod-code/repositories/pod-code.repository';
import { VesselCodeRepository } from '../../vessel-code/repositories/vessel-code.repository';
import { PolCodeRepository } from './pol-code.repository';

const tenantId = '00000000-0000-4000-8000-000000000001';
const typeId = '00000000-0000-4000-8000-000000000002';
const row = {
  id: '00000000-0000-4000-8000-000000000003',
  name: 'Value',
  code: 'CODE',
  sortOrder: 0,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeRepository(Repository: new (uow: never) => PolCodeRepository) {
  const db = {
    optionType: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: typeId }),
    },
    optionValue: {
      findMany: jest.fn().mockResolvedValue([row]),
      findFirst: jest.fn().mockResolvedValue(row),
      create: jest.fn().mockResolvedValue(row),
      update: jest.fn().mockResolvedValue(row),
    },
    bidDetail: { count: jest.fn().mockResolvedValue(0) },
  };
  const uow = {
    execute: jest.fn((work: (database: typeof db) => unknown) => work(db)),
  };
  return { db, repository: new Repository(uow as never) };
}

async function inTenant<T>(work: () => Promise<T>): Promise<T> {
  return RequestContext.run({ requestId: 'reference-test', tenantId }, work);
}

const modules = [
  ['POL', OptionTypeCode.POL, PolCodeRepository],
  ['POD', OptionTypeCode.POD, PodCodeRepository],
  ['CARGO_CODE', OptionTypeCode.CARGO_CODE, CargoCodeRepository],
  ['VESSEL_CODE', OptionTypeCode.VESSEL_CODE, VesselCodeRepository],
] as const;

describe.each(modules)(
  '%s repository tenant and OptionType predicates',
  (_name, optionType, Repository) => {
    it('owns its fixed type and scopes list, get, update, and lifecycle to the current tenant', async () => {
      const { db, repository } = makeRepository(Repository as never);

      await inTenant(() => repository.list(false));
      await inTenant(() => repository.find(row.id));
      await inTenant(() =>
        repository.update(row.id, { name: ' Updated ', code: ' new ' }),
      );
      await inTenant(() => repository.setActive(row.id, false));

      expect(db.optionType.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { code: optionType },
        select: { id: true },
      });
      expect(db.optionValue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId,
            optionTypeId: typeId,
            isActive: true,
          }),
        }),
      );
      expect(db.optionValue.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: row.id,
            tenantId,
            optionTypeId: typeId,
          }),
        }),
      );
      expect(db.optionValue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: row.id },
          data: expect.objectContaining({ name: 'Updated', code: 'NEW' }),
        }),
      );
      expect(db.optionValue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: row.id },
          data: expect.objectContaining({ isActive: false }),
        }),
      );
    });
  },
);

describe('cross-module OptionType protection', () => {
  it('resolves a different fixed type for every repository rather than accepting caller input', async () => {
    const observed: OptionTypeCode[] = [];
    for (const [, optionType, Repository] of modules) {
      const { db, repository } = makeRepository(Repository as never);
      await inTenant(() => repository.find(row.id));
      observed.push(
        db.optionType.findUniqueOrThrow.mock.calls[0][0].where.code,
      );
      expect(db.optionValue.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId,
            optionTypeId: typeId,
            id: row.id,
          }),
        }),
      );
      expect(optionType).toBe(observed.at(-1));
    }
    expect(observed).toEqual([
      OptionTypeCode.POL,
      OptionTypeCode.POD,
      OptionTypeCode.CARGO_CODE,
      OptionTypeCode.VESSEL_CODE,
    ]);
  });
});

describe('prepared normalized OptionValue uniqueness migration', () => {
  const migration = readFileSync(
    resolve(
      process.cwd(),
      'prisma/migrations/20260916000004_add_option_value_normalized_uniqueness/migration.sql',
    ),
    'utf8',
  );

  it('scopes normalized names to tenant and OptionType without replacing raw uniqueness', () => {
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "option_values_tenant_type_normalized_name_unique"',
    );
    expect(migration).toContain(
      'ON "option_values" ("tenant_id", "option_type_id", lower(btrim("name")))',
    );
    expect(migration).toContain(
      'The existing raw (tenant_id, option_type_id, name) unique constraint remains in place.',
    );
  });

  it('scopes non-null normalized codes to tenant and OptionType', () => {
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "option_values_tenant_type_normalized_code_unique"',
    );
    expect(migration).toContain(
      'ON "option_values" ("tenant_id", "option_type_id", upper(btrim("code")))',
    );
    expect(migration).toContain('WHERE "code" IS NOT NULL;');
  });

  it('contains no mutation, RLS, or cross-type category condition', () => {
    expect(migration).not.toMatch(
      /\b(?:INSERT|UPDATE|DELETE|ALTER|GRANT|REVOKE)\b/,
    );
    expect(migration).not.toMatch(
      /ROW LEVEL SECURITY|POL|POD|CARGO_CODE|VESSEL_CODE/,
    );
  });
});

describe('prepared global OptionType provisioning migration', () => {
  const migration = readFileSync(
    resolve(
      process.cwd(),
      'prisma/migrations/20260916000005_provision_option_types/migration.sql',
    ),
    'utf8',
  );

  it('provisions exactly the eight fixed global codes idempotently', () => {
    expect(migration).toContain(
      'INSERT INTO "option_types" ("id", "code", "name")',
    );
    expect(migration).toContain('ON CONFLICT ("code") DO NOTHING;');
    expect(migration.match(/::"option_type_code"/g)).toHaveLength(8);
    for (const code of [
      'POL',
      'POD',
      'CARGO_CODE',
      'VESSEL_CODE',
      'PROJECT_INFO_CATEGORY',
      'WORK_REQUEST_TYPE',
      'DOCUMENT_CATEGORY',
      'ATTACHMENT_CATEGORY',
    ]) {
      expect(migration).toContain(`'${code}'::"option_type_code"`);
    }
  });

  it('does not introduce tenant data, OptionValues, or static IDs', () => {
    expect(migration).toContain('gen_random_uuid()');
    expect(migration).not.toMatch(
      /tenant_id|option_values|ROW LEVEL SECURITY|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
  });
});

describe('prepared Module 06 runtime privilege migration', () => {
  const migration = readFileSync(
    resolve(
      process.cwd(),
      'prisma/migrations/20260916000006_grant_option_value_runtime_access/migration.sql',
    ),
    'utf8',
  );

  it('grants exactly the table privileges required by the Module 06 paths', () => {
    expect(migration).toContain(
      'GRANT SELECT ON TABLE "option_types" TO app_user;',
    );
    expect(migration).toContain(
      'GRANT SELECT, INSERT, UPDATE ON TABLE "option_values" TO app_user;',
    );
    expect(migration).toContain(
      'GRANT SELECT ON TABLE "bid_details" TO app_user;',
    );
  });

  it('does not alter RLS or grant destructive privileges', () => {
    const executableSql = migration
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n');

    expect(executableSql).not.toMatch(
      /ROW LEVEL SECURITY|CREATE POLICY|ALTER TABLE|GRANT DELETE/i,
    );
  });
});

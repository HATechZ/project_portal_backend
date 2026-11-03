/* Focused real-PostgreSQL regression. Use an EMPTY disposable local database only.
 * Run yarn build first, then provide ROLE_SCOPE_TEST_DATABASE_URL explicitly.
 * No application .env is loaded; no shared/live database fallback is accepted.
 */
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { Client } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../dist/generated/prisma/client.js');
const {
  createTenantPrismaClient,
} = require('../dist/infra/prisma/tenant-prisma.extension.js');
const { RequestContext } = require('../dist/common/context/request-context.js');
const {
  UnitOfWorkService,
} = require('../dist/infra/prisma/unit-of-work.service.js');
const {
  RolePermissionRepository,
} = require('../dist/role-permission/repositories/role-permission.repository.js');
const {
  RolePermissionMutationProvider,
} = require('../dist/role-permission/providers/role-permission-mutation.provider.js');

const tenant = '10000000-0000-4000-8000-000000000001';
const role = '20000000-0000-4000-8000-000000000001';
const common = '30000000-0000-4000-8000-000000000001';
const division = '30000000-0000-4000-8000-000000000002';
const grantA = '40000000-0000-4000-8000-000000000001';
const grantB = '40000000-0000-4000-8000-000000000002';
const user = '50000000-0000-4000-8000-000000000001';

function migrationFunction(path, name) {
  const source = readFileSync(resolve(__dirname, '..', path), 'utf8');
  const start = source.indexOf(`CREATE OR REPLACE FUNCTION public.${name}()`);
  assert.ok(start >= 0, `Missing migration function ${name}`);
  const end = source.indexOf(
    '$function$;',
    source.indexOf('AS $function$', start),
  );
  assert.ok(end >= 0, `Missing function terminator for ${name}`);
  return source.slice(start, end + '$function$;'.length);
}

async function main() {
  const connectionString = process.env.ROLE_SCOPE_TEST_DATABASE_URL;
  assert.ok(
    connectionString,
    'ROLE_SCOPE_TEST_DATABASE_URL must explicitly name an EMPTY disposable database.',
  );
  const target = new URL(connectionString);
  assert.ok(
    ['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname),
    'Only a local disposable database is accepted.',
  );
  assert.equal(
    target.pathname,
    '/role_scope_reconciliation_test',
    'Dedicated test database name required.',
  );
  const db = new Client({ connectionString, connectionTimeoutMillis: 10000 });
  let prisma;
  try {
    await db.connect();
    const existing = await db.query(
      "SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public'",
    );
    assert.equal(
      existing.rows[0].count,
      0,
      'Database must be empty. This script never resets or drops existing data.',
    );
    await db.query(`
      CREATE TYPE custom_role_scope AS ENUM ('company','division','team','member','client','client_contact');
      CREATE TYPE permission_code AS ENUM ('VIEW_MEMBERS','ASSIGN_WORK_REQUEST_DIVISION','ACCEPT_FINAL_DELIVERY','REJECT_FINAL_DELIVERY','REQUEST_REVISION');
      CREATE TYPE actor_role_code AS ENUM ('tenant_super_admin');
      CREATE TABLE tenants (id uuid PRIMARY KEY);
      CREATE TABLE roles (id uuid PRIMARY KEY,tenant_id uuid REFERENCES tenants(id),name text,description text,is_system_role boolean NOT NULL DEFAULT false,custom_code text,custom_scope custom_role_scope,is_active boolean NOT NULL DEFAULT true,retired_at timestamp,created_at timestamp DEFAULT now());
      CREATE TABLE permissions (id uuid PRIMARY KEY,code permission_code,display_name text,description text,category text,action_type text,resource text);
      CREATE TABLE permission_scope_compatibilities (permission_id uuid REFERENCES permissions(id),scope custom_role_scope,PRIMARY KEY(permission_id,scope));
      CREATE TABLE permission_dependencies (permission_id uuid REFERENCES permissions(id),required_permission_id uuid REFERENCES permissions(id),PRIMARY KEY(permission_id,required_permission_id));
      CREATE TABLE system_roles (role_id uuid PRIMARY KEY REFERENCES roles(id),system_code actor_role_code);
      CREATE TABLE user_roles (id uuid PRIMARY KEY,tenant_id uuid REFERENCES tenants(id),user_id uuid,role_id uuid REFERENCES roles(id),team_id uuid,revoked_at timestamp);
      CREATE TABLE companies (id uuid PRIMARY KEY,tenant_id uuid,is_active boolean);
      CREATE TABLE divisions (id uuid PRIMARY KEY,tenant_id uuid,company_id uuid,is_active boolean);
      CREATE TABLE members (id uuid PRIMARY KEY,tenant_id uuid,user_id uuid,is_active boolean,division_id uuid REFERENCES divisions(id),company_id uuid REFERENCES companies(id));
      CREATE TABLE clients (id uuid PRIMARY KEY,tenant_id uuid,is_active boolean);
      CREATE TABLE client_contacts (id uuid PRIMARY KEY,tenant_id uuid,user_id uuid,is_active boolean,client_id uuid REFERENCES clients(id));
      CREATE TABLE actor_profiles (id uuid PRIMARY KEY,tenant_id uuid REFERENCES tenants(id),user_id uuid,role_id uuid REFERENCES roles(id),member_id uuid REFERENCES members(id),client_contact_id uuid REFERENCES client_contacts(id),is_active boolean);
      CREATE TABLE role_permissions (id uuid PRIMARY KEY,tenant_id uuid CONSTRAINT role_permissions_tenant_id_fkey REFERENCES tenants(id),role_id uuid CONSTRAINT role_permissions_role_id_fkey REFERENCES roles(id),permission_id uuid CONSTRAINT role_permissions_permission_id_fkey REFERENCES permissions(id),granted_at timestamp DEFAULT now(),revoked_at timestamp);
      CREATE UNIQUE INDEX role_permissions_one_active_grant_key ON role_permissions(tenant_id,role_id,permission_id) WHERE revoked_at IS NULL;
    `);
    await db.query(
      migrationFunction(
        'prisma/migrations/20261028000000_align_tenant_super_admin_internal_permission_grants/migration.sql',
        'assert_role_permission_tenant_match',
      ),
    );
    await db.query(
      migrationFunction(
        'prisma/migrations/20260928000100_add_user_role_team_scope_binding/migration.sql',
        'assert_role_user_role_team_scope_shape',
      ),
    );
    await db.query(
      `CREATE CONSTRAINT TRIGGER role_permissions_role_tenant_match AFTER INSERT OR UPDATE OF tenant_id,role_id ON role_permissions DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION assert_role_permission_tenant_match(); CREATE CONSTRAINT TRIGGER roles_user_role_team_scope_shape AFTER UPDATE OF is_system_role,custom_scope ON roles DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION assert_role_user_role_team_scope_shape();`,
    );
    await db.query('INSERT INTO tenants VALUES($1)', [tenant]);
    await db.query(
      "INSERT INTO roles(id,tenant_id,name,custom_code,custom_scope) VALUES($1,$2,'Scope regression','scope_regression','division')",
      [role, tenant],
    );
    await db.query(
      "INSERT INTO permissions(id,code,display_name,category,action_type,resource) VALUES($1,'VIEW_MEMBERS','View members','MEMBERS','VIEW','Member'),($2,'ASSIGN_WORK_REQUEST_DIVISION','Assign division','WORK_REQUESTS','ASSIGN','WorkRequest')",
      [common, division],
    );
    await db.query(
      "INSERT INTO permission_scope_compatibilities VALUES($1,'company'),($1,'division'),($2,'division')",
      [common, division],
    );
    await db.query(
      'INSERT INTO role_permissions(id,tenant_id,role_id,permission_id) VALUES($1,$2,$3,$4),($5,$2,$3,$6)',
      [grantA, tenant, role, common, grantB, division],
    );
    await db.query(
      "INSERT INTO user_roles(id,tenant_id,user_id,role_id) VALUES('60000000-0000-4000-8000-000000000001',$1,$2,$3)",
      [tenant, user, role],
    );
    await db.query(
      "INSERT INTO actor_profiles(id,tenant_id,user_id,role_id,is_active) VALUES('70000000-0000-4000-8000-000000000001',$1,$2,$3,true)",
      [tenant, user, role],
    );

    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
      log: [{ emit: 'event', level: 'query' }],
    });
    const queries = [];
    prisma.$on('query', (event) => {
      queries.push(event.query);
    });
    const scoped = createTenantPrismaClient(prisma);
    const repository = new RolePermissionRepository(
      new UnitOfWorkService({ scoped }),
    );
    const provider = new RolePermissionMutationProvider(repository, {}, {});
    const snapshot = async () => ({
      roles: (await db.query('SELECT * FROM roles ORDER BY id')).rows,
      grants: (await db.query('SELECT * FROM role_permissions ORDER BY id'))
        .rows,
      assignments: (await db.query('SELECT * FROM user_roles ORDER BY id'))
        .rows,
      profiles: (await db.query('SELECT * FROM actor_profiles ORDER BY id'))
        .rows,
    });
    const initial = await snapshot();
    await RequestContext.run(
      { tenantId: tenant, requestId: 'role-scope-regression' },
      async () => {
        let captured;
        try {
          await scoped.$transaction(async (tx) => {
            await tx.role.updateMany({
              where: { id: role, tenantId: tenant, isSystemRole: false },
              data: { customScope: 'company' },
            });
            await tx.rolePermission.updateMany({
              where: { id: { in: [grantB] } },
              data: { revokedAt: new Date() },
            });
          });
        } catch (error) {
          captured = error;
        }
        assert.equal(captured?.code, 'P2003');
        assert.equal(captured?.meta?.modelName, 'RolePermission');
        assert.equal(
          captured?.meta?.driverAdapterError?.cause?.originalCode,
          '23503',
        );
        console.log(
          'OLD_PRISMA_ERROR',
          JSON.stringify({ code: captured.code, meta: captured.meta }),
        );
        console.log(
          'CONSTRAINT_CONTEXT',
          JSON.stringify({
            constraintTrigger: 'role_permissions_role_tenant_match',
            table: 'public.role_permissions',
            referencedTables: [
              'public.roles',
              'public.permission_scope_compatibilities',
            ],
            attemptedOperation:
              'UPDATE role_permissions SET revoked_at = ..., tenant_id = ... after changing Role.customScope',
          }),
        );
        assert.deepEqual(
          await snapshot(),
          initial,
          'The failed old transaction must roll back.',
        );
        await db.query('BEGIN');
        try {
          await db.query(
            "UPDATE roles SET custom_scope='company' WHERE id=$1",
            [role],
          );
          await db.query(
            'UPDATE role_permissions SET revoked_at=now(),tenant_id=$1 WHERE id=$2',
            [tenant, grantB],
          );
          assert.fail('Expected PostgreSQL constraint trigger failure.');
        } catch (error) {
          assert.equal(error.code, '23503');
          assert.match(error.where, /assert_role_permission_tenant_match/);
          console.log(
            'OLD_POSTGRESQL_ERROR',
            JSON.stringify({
              code: error.code,
              message: error.message,
              table: error.table ?? null,
              constraint: error.constraint ?? null,
              where: error.where,
            }),
          );
        } finally {
          await db.query('ROLLBACK');
        }
        await assert.rejects(
          provider.setRolePermissions(role, { scope: 'company' }),
          (error) => {
            assert.equal(error.getStatus(), 400);
            assert.deepEqual(error.details.incompatiblePermissions, [
              {
                id: division,
                code: 'ASSIGN_WORK_REQUEST_DIVISION',
                name: 'Assign division',
              },
            ]);
            return true;
          },
        );
        assert.deepEqual(await snapshot(), initial);
        const response = await provider.setRolePermissions(role, {
          scope: 'company',
          permissionIds: [common],
        });
        assert.equal(response.scope, 'company');
        assert.deepEqual(
          response.permissions.map(({ id }) => id),
          [common],
        );
        const fixed = await snapshot();
        assert.deepEqual(
          fixed.grants[0],
          initial.grants[0],
          'Kept grant ID/timestamps remain unchanged.',
        );
        assert.equal(fixed.grants[1].id, grantB);
        assert.ok(fixed.grants[1].revoked_at instanceof Date);
        assert.deepEqual(fixed.assignments, initial.assignments);
        assert.deepEqual(fixed.profiles, initial.profiles);
        await provider.setRolePermissions(role, {
          scope: 'company',
          permissionIds: [common],
        });
        assert.deepEqual(
          await snapshot(),
          fixed,
          'Repeated Save must be idempotent.',
        );
        assert.ok(
          queries.some((sql) =>
            /UPDATE "public"\."role_permissions" SET "revoked_at" = .*"tenant_id" =/.test(
              sql,
            ),
          ),
          'Real tenant extension must inject tenant_id into grant revocation SQL.',
        );
        console.log(
          'FIXED_FLOW_PASS',
          JSON.stringify({
            scope: response.scope,
            preservedGrantId: grantA,
            revokedGrantId: grantB,
            revokedAt: fixed.grants[1].revoked_at,
            repeatedSave: 'identical state',
            assignments: 'unchanged',
            profiles: 'unchanged',
          }),
        );
      },
    );
  } finally {
    if (prisma) await prisma.$disconnect();
    await db.end();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

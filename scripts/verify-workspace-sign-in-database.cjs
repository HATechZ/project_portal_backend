const crypto = require('node:crypto');
const { Pool } = require('pg');
require('dotenv').config({ quiet: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  assert(process.env.DATABASE_URL_MIGRATION, 'DATABASE_URL_MIGRATION is required');
  assert(process.env.DATABASE_URL, 'DATABASE_URL is required');
  const admin = new Pool({ connectionString: process.env.DATABASE_URL_MIGRATION });
  const runtime = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const migration = await admin.query(`
      SELECT finished_at IS NOT NULL AS finished, rolled_back_at IS NULL AS not_rolled_back
      FROM public._prisma_migrations
      WHERE migration_name = '20260903020000_global_normalized_email_login'
    `);
    assert(migration.rowCount === 1 && migration.rows[0].finished && migration.rows[0].not_rolled_back,
      'migration is not recorded as successfully applied');

    const schema = await admin.query(`
      SELECT
        (SELECT is_nullable = 'NO' FROM information_schema.columns
         WHERE table_schema='public' AND table_name='companies' AND column_name='workspace_slug') AS not_null,
        (SELECT data_type='character varying' AND character_maximum_length=100
         FROM information_schema.columns
         WHERE table_schema='public' AND table_name='companies' AND column_name='workspace_slug') AS correct_type,
        EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='companies'
                AND indexname='companies_workspace_slug_key' AND indexdef LIKE 'CREATE UNIQUE INDEX%') AS slug_unique,
        EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='companies'
                AND indexname='companies_tenant_id_key' AND indexdef LIKE 'CREATE UNIQUE INDEX%') AS tenant_unique,
        EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.companies'::regclass
                AND contype='f' AND confrelid='public.tenants'::regclass AND convalidated) AS tenant_fk,
        (SELECT relrowsecurity FROM pg_class WHERE oid='public.companies'::regclass) AS company_rls,
        (SELECT relrowsecurity FROM pg_class WHERE oid='public.tenants'::regclass) AS tenant_rls,
        EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.companies'::regclass
                AND tgname='companies_generate_workspace_slug' AND NOT tgisinternal
                AND pg_get_triggerdef(oid) LIKE '%BEFORE INSERT OR UPDATE OF workspace_slug%') AS immutable_trigger,
        EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.companies'::regclass
                AND conname='companies_workspace_slug_format_check' AND convalidated) AS format_check,
        EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.users'::regclass
                AND conname='users_email_canonical_check' AND convalidated) AS email_canonical,
        EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.users'::regclass
                AND conname='users_email_key' AND contype='u') AS email_global_unique,
        to_regclass('public.users_tenant_id_email_key') IS NULL AS old_email_index_absent,
        EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='users'
                AND indexname='users_tenant_id_idx') AS user_tenant_index,
        (SELECT relrowsecurity FROM pg_class WHERE oid='public.users'::regclass) AS user_rls,
        to_regprocedure('public.resolve_company_workspace(text)') IS NULL AS old_resolver_absent
    `);
    for (const [key, value] of Object.entries(schema.rows[0])) assert(value, `schema check failed: ${key}`);

    const data = await admin.query(`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE workspace_slug IS NULL OR workspace_slug = '')::int AS blank,
             count(*) FILTER (WHERE workspace_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$')::int AS invalid,
             count(*)::int - count(DISTINCT workspace_slug)::int AS duplicates
      FROM public.companies
    `);
    assert(data.rows[0].blank === 0 && data.rows[0].invalid === 0 && data.rows[0].duplicates === 0,
      'workspace slug backfill data is invalid');

    const functions = await admin.query(`
      SELECT p.proname,
             p.prosecdef,
             p.proconfig,
             pg_get_userbyid(p.proowner) AS owner,
             has_function_privilege('app_user', p.oid, 'EXECUTE') AS app_user_execute,
             has_function_privilege('app_relay', p.oid, 'EXECUTE') AS app_relay_execute,
             EXISTS (
               SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl
               WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
             ) AS public_execute,
             pg_get_functiondef(p.oid) AS definition
      FROM pg_proc p
      WHERE p.oid IN (
        to_regprocedure('public.provision_company_workspace(text,text,uuid,text,text,text,text,text)'),
        to_regprocedure('public.provision_company_workspace_core(text,text,uuid,text,text,text,text,text)'),
        to_regprocedure('public.resolve_user_login_email(text)')
      )
    `);
    assert(functions.rowCount === 3, 'expected three workspace functions');
    const currentUser = (await admin.query('SELECT current_user')).rows[0].current_user;
    for (const fn of functions.rows) {
      assert(fn.prosecdef, `${fn.proname} is not SECURITY DEFINER`);
      assert(fn.proconfig?.includes('search_path=pg_catalog'), `${fn.proname} search_path is unsafe`);
      assert(fn.owner === currentUser, `${fn.proname} owner is not the migration role`);
      assert(!fn.public_execute, `${fn.proname} is executable by PUBLIC`);
      assert(!fn.app_relay_execute, `${fn.proname} is executable by app_relay`);
    }
    const wrapper = functions.rows.find((fn) => fn.proname === 'provision_company_workspace');
    const core = functions.rows.find((fn) => fn.proname === 'provision_company_workspace_core');
    const resolver = functions.rows.find((fn) => fn.proname === 'resolve_user_login_email');
    assert(wrapper.app_user_execute, 'app_user cannot execute provisioning wrapper');
    assert(!core.app_user_execute, 'app_user can execute provisioning core');
    assert(resolver.app_user_execute, 'app_user cannot execute email resolver');
    assert(resolver.definition.includes('app_user_record.is_active = true') &&
      resolver.definition.includes('tenant.is_active = true'), 'resolver does not enforce activation');
    assert(resolver.definition.includes('RETURNS TABLE(tenant_id uuid)'), 'resolver exposes more than tenant_id');

    const roles = await admin.query(`
      SELECT rolname, rolsuper, rolbypassrls
      FROM pg_roles WHERE rolname IN ('app_user', 'app_relay') ORDER BY rolname
    `);
    assert(roles.rowCount === 2, 'runtime database roles missing');
    const appUser = roles.rows.find((role) => role.rolname === 'app_user');
    assert(!appUser.rolsuper && !appUser.rolbypassrls, 'app_user bypasses RLS');

    const relayCompanyPrivileges = await admin.query(`
      SELECT privilege_type FROM information_schema.role_table_grants
      WHERE grantee='app_relay' AND table_schema='public' AND table_name='companies'
    `);
    assert(relayCompanyPrivileges.rowCount === 0, 'app_relay has Company table privileges');

    let tenantlessUsersBlocked = false;
    try {
      const tenantlessUsers = await runtime.query('SELECT id FROM public.users LIMIT 1');
      tenantlessUsersBlocked = tenantlessUsers.rowCount === 0;
    } catch {
      tenantlessUsersBlocked = true;
    }
    assert(tenantlessUsersBlocked, 'app_user can broadly SELECT Users without Tenant context');

    const immutableTarget = await admin.query(
      'SELECT id, workspace_slug FROM public.companies ORDER BY id LIMIT 1',
    );
    assert(immutableTarget.rowCount === 1, 'no Company exists for immutability verification');
    const adminClient = await admin.connect();
    let immutableRejected = false;
    try {
      await adminClient.query('BEGIN');
      await adminClient.query(
        `UPDATE public.companies
         SET workspace_slug = workspace_slug || '-changed'
         WHERE id = $1`,
        [immutableTarget.rows[0].id],
      );
    } catch (error) {
      immutableRejected = error.code === '22023';
    } finally {
      await adminClient.query('ROLLBACK');
      adminClient.release();
    }
    assert(immutableRejected, 'workspace slug mutation was not rejected by the trigger');
    const immutableAfter = await admin.query(
      'SELECT workspace_slug FROM public.companies WHERE id = $1',
      [immutableTarget.rows[0].id],
    );
    assert(immutableAfter.rows[0].workspace_slug === immutableTarget.rows[0].workspace_slug,
      'workspace slug changed despite rollback');

    const verificationClient = await admin.connect();
    try {
      await verificationClient.query('BEGIN');
      const reference = await verificationClient.query(`
        SELECT id FROM public.company_types ORDER BY id LIMIT 1
      `);
      assert(reference.rowCount === 1, 'CompanyType reference row missing');
      const before = await verificationClient.query(`
        SELECT (SELECT count(*) FROM public.tenants)::int AS tenants,
               (SELECT count(*) FROM public.companies)::int AS companies,
               (SELECT count(*) FROM public.users)::int AS users
      `);
      const marker = crypto.randomUUID();
      const uniqueEmail = `workspace-${marker}@example.invalid`;
      const args = [
        'Workspace Collision Verification', 'WCV', reference.rows[0].id,
        'Verification Admin', uniqueEmail,
        '$2b$12$verification.hash.not.a.plaintext.password', 'Bangladesh', '+8800000000000',
      ];
      await verificationClient.query('SET LOCAL ROLE app_user');
      const first = await verificationClient.query(
        'SELECT tenant_id, workspace_slug FROM public.provision_company_workspace($1,$2,$3,$4,$5,$6,$7,$8)', args,
      );
      assert(first.rows[0].workspace_slug === 'workspace-collision-verification',
        'first signup did not receive readable base slug');
      const resolved = await verificationClient.query(
        'SELECT tenant_id FROM public.resolve_user_login_email($1)', [`  ${uniqueEmail.toUpperCase()}  `],
      );
      assert(resolved.rowCount === 1 && resolved.rows[0].tenant_id === first.rows[0].tenant_id,
        'email resolver did not resolve the provisioned active User Tenant');
      const absent = await verificationClient.query(
        'SELECT tenant_id FROM public.resolve_user_login_email($1)', ['unknown@example.invalid'],
      );
      assert(absent.rowCount === 0, 'resolver returned a row for an unknown email');

      await verificationClient.query('RESET ROLE');
      const afterFirst = await verificationClient.query(`
        SELECT (SELECT count(*) FROM public.tenants)::int AS tenants,
               (SELECT count(*) FROM public.companies)::int AS companies,
               (SELECT count(*) FROM public.users)::int AS users
      `);
      await verificationClient.query('SAVEPOINT duplicate_signup');
      await verificationClient.query('SET LOCAL ROLE app_user');
      args[0] = 'Duplicate Email Verification';
      args[1] = 'DEV';
      args[4] = `  ${uniqueEmail.toUpperCase()}  `;
      let duplicateRejected = false;
      try {
        await verificationClient.query(
          'SELECT tenant_id FROM public.provision_company_workspace($1,$2,$3,$4,$5,$6,$7,$8)', args,
        );
      } catch (error) {
        duplicateRejected = error.code === '23505';
        await verificationClient.query('ROLLBACK TO SAVEPOINT duplicate_signup');
      }
      assert(duplicateRejected, 'case/whitespace-equivalent signup email was not rejected');
      await verificationClient.query('RESET ROLE');
      const afterDuplicate = await verificationClient.query(`
        SELECT (SELECT count(*) FROM public.tenants)::int AS tenants,
               (SELECT count(*) FROM public.companies)::int AS companies,
               (SELECT count(*) FROM public.users)::int AS users
      `);
      assert(JSON.stringify(afterDuplicate.rows[0]) === JSON.stringify(afterFirst.rows[0]),
        'failed duplicate signup left Tenant, Company, or User remnants');
      await verificationClient.query('ROLLBACK');
      const afterRollback = await admin.query(`
        SELECT (SELECT count(*) FROM public.tenants)::int AS tenants,
               (SELECT count(*) FROM public.companies)::int AS companies,
               (SELECT count(*) FROM public.users)::int AS users
      `);
      assert(JSON.stringify(afterRollback.rows[0]) === JSON.stringify(before.rows[0]),
        'rollback-only verification persisted business data');
    } catch (error) {
      await verificationClient.query('ROLLBACK');
      throw error;
    } finally {
      verificationClient.release();
    }

    process.stdout.write(
      `Workspace database verification PASS: ${data.rows[0].total} backfilled Companies; ` +
      'schema, migration, RLS, ACL, email resolver, and rollback-only duplicate checks passed.\n',
    );
  } finally {
    await Promise.all([admin.end(), runtime.end()]);
  }
}

main().catch((error) => {
  process.stderr.write(`Workspace database verification FAIL: ${error.message}\n`);
  process.exitCode = 1;
});

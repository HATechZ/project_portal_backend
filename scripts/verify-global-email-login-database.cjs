const { Pool } = require('pg');
require('dotenv').config();

async function main() {
  const connectionString = process.env.DATABASE_URL_MIGRATION;
  if (!connectionString) throw new Error('DATABASE_URL_MIGRATION is required');
  const pool = new Pool({ connectionString });
  try {
    const { rows } = await pool.query(`
      SELECT
        EXISTS (
          SELECT 1 FROM public._prisma_migrations
          WHERE migration_name = '20260903020000_global_normalized_email_login'
            AND finished_at IS NOT NULL AND rolled_back_at IS NULL
        ) AS migration_applied,
        EXISTS (
          SELECT 1 FROM pg_catalog.pg_constraint
          WHERE conrelid = 'public.users'::regclass
            AND conname = 'users_email_canonical_check' AND contype = 'c'
        ) AS canonical_check,
        EXISTS (
          SELECT 1 FROM pg_catalog.pg_constraint
          WHERE conrelid = 'public.users'::regclass
            AND conname = 'users_email_key' AND contype = 'u'
        ) AS global_unique,
        to_regclass('public.users_tenant_id_email_key') IS NULL AS old_index_absent,
        to_regclass('public.users_tenant_id_idx') IS NOT NULL AS tenant_index,
        EXISTS (
          SELECT 1 FROM pg_catalog.pg_constraint
          WHERE conrelid = 'public.users'::regclass AND contype = 'f'
            AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (tenant_id)%REFERENCES tenants(id)%'
        ) AS tenant_fk,
        (SELECT relrowsecurity FROM pg_catalog.pg_class
         WHERE oid = 'public.users'::regclass) AS users_rls,
        to_regprocedure('public.resolve_user_login_email(text)') IS NOT NULL AS resolver_exists,
        to_regprocedure('public.resolve_company_workspace(text)') IS NULL AS old_resolver_absent,
        NOT EXISTS (
          SELECT 1 FROM pg_catalog.pg_proc AS resolver,
          LATERAL aclexplode(coalesce(resolver.proacl, acldefault('f', resolver.proowner))) AS grant_row
          WHERE resolver.oid = to_regprocedure('public.resolve_user_login_email(text)')
            AND grant_row.grantee = 0 AND grant_row.privilege_type = 'EXECUTE'
        ) AS public_execute_revoked,
        EXISTS (
          SELECT 1 FROM pg_catalog.pg_proc AS resolver,
          LATERAL aclexplode(coalesce(resolver.proacl, acldefault('f', resolver.proowner))) AS grant_row
          WHERE resolver.oid = to_regprocedure('public.resolve_user_login_email(text)')
            AND grant_row.grantee = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'app_user')
            AND grant_row.privilege_type = 'EXECUTE'
        ) AS app_user_execute,
        NOT EXISTS (
          SELECT 1 FROM pg_catalog.pg_proc AS resolver,
          LATERAL aclexplode(coalesce(resolver.proacl, acldefault('f', resolver.proowner))) AS grant_row
          WHERE resolver.oid = to_regprocedure('public.resolve_user_login_email(text)')
            AND grant_row.grantee = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'app_relay')
            AND grant_row.privilege_type = 'EXECUTE'
        ) AS app_relay_no_execute,
        (SELECT prosecdef FROM pg_catalog.pg_proc
         WHERE oid = to_regprocedure('public.resolve_user_login_email(text)')) AS security_definer,
        (SELECT proconfig @> ARRAY['search_path=pg_catalog']
         FROM pg_catalog.pg_proc
         WHERE oid = to_regprocedure('public.resolve_user_login_email(text)')) AS safe_search_path,
        (SELECT rolname FROM pg_catalog.pg_roles
         WHERE oid = (SELECT proowner FROM pg_catalog.pg_proc
                      WHERE oid = to_regprocedure('public.resolve_user_login_email(text)')))
          AS function_owner,
        EXISTS (
          SELECT 1 FROM pg_catalog.pg_indexes
          WHERE schemaname = 'public' AND tablename = 'companies'
            AND indexname = 'companies_workspace_slug_key'
        ) AS workspace_slug_unique,
        (SELECT is_nullable = 'NO' FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'companies'
           AND column_name = 'workspace_slug') AS workspace_slug_required
    `);
    process.stdout.write(`Global email-login database verification: ${JSON.stringify(rows[0])}\n`);
    if (Object.entries(rows[0]).some(([key, value]) => key !== 'function_owner' && value !== true)) {
      process.exitCode = 2;
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  process.stderr.write(`Global email-login database verification FAIL: ${error.message}\n`);
  process.exitCode = 1;
});

const { Pool } = require('pg');
require('dotenv').config();

function baseSlug(name) {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
    .replace(/-+$/g, '');
  return normalized || 'company';
}

async function main() {
  const connectionString = process.env.DATABASE_URL_MIGRATION;
  if (!connectionString) {
    throw new Error('DATABASE_URL_MIGRATION is required');
  }

  const pool = new Pool({ connectionString });
  try {
    const migrationResult = await pool.query(
      `SELECT finished_at IS NOT NULL AND rolled_back_at IS NULL AS applied
       FROM public._prisma_migrations
       WHERE migration_name = '20260903010000_workspace_aware_universal_sign_in'`,
    );
    const migrationApplied = migrationResult.rows[0]?.applied === true;
    const columnResult = await pool.query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'companies'
           AND column_name = 'workspace_slug'
       ) AS exists`,
    );
    const hasWorkspaceSlug = columnResult.rows[0].exists;
    const { rows } = await pool.query(
      hasWorkspaceSlug
        ? 'SELECT id::text, name, workspace_slug FROM public.companies ORDER BY id'
        : 'SELECT id::text, name, NULL::text AS workspace_slug FROM public.companies ORDER BY id',
    );
    const used = new Set();
    let collisions = 0;
    for (const row of rows) {
      const base = baseSlug(row.name);
      let candidate = base;
      let attempt = 0;
      while (used.has(candidate)) {
        collisions += 1;
        attempt += 1;
        candidate = `${base.slice(0, 58)}-${row.id.replaceAll('-', '')}-${attempt}`;
      }
      if (!candidate || candidate.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate)) {
        throw new Error(`Company ${row.id} cannot be assigned a valid workspace slug`);
      }
      used.add(candidate);
    }

    const existingNonNull = rows.filter((row) => row.workspace_slug !== null).length;
    process.stdout.write(
      `Workspace slug preflight PASS: ${rows.length} companies, ${collisions} base collision(s), ${existingNonNull} already populated.\n`,
    );
    process.stdout.write(`Migration already applied: ${migrationApplied}.\n`);
    if (hasWorkspaceSlug) {
      const stateResult = await pool.query(`
        SELECT
          (SELECT is_nullable FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'companies'
             AND column_name = 'workspace_slug') AS nullable,
          EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
                  AND tablename = 'companies' AND indexname = 'companies_workspace_slug_key') AS unique_index,
          to_regprocedure('public.resolve_company_workspace(text)') IS NOT NULL AS resolver_exists,
          to_regprocedure('public.provision_company_workspace_core(text,text,uuid,text,text,text,text,text)') IS NOT NULL
            AS core_exists
      `);
      const state = stateResult.rows[0];
      process.stdout.write(
        `Current column state: nullable=${state.nullable}, uniqueIndex=${state.unique_index}, ` +
          `resolver=${state.resolver_exists}, core=${state.core_exists}.\n`,
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  process.stderr.write(`Workspace slug preflight FAIL: ${error.message}\n`);
  process.exitCode = 1;
});

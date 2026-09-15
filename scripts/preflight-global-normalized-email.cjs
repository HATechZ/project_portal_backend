const { Pool } = require('pg');
require('dotenv').config();

async function main() {
  const connectionString = process.env.DATABASE_URL_MIGRATION;
  if (!connectionString) throw new Error('DATABASE_URL_MIGRATION is required');

  const pool = new Pool({ connectionString });
  try {
    const summary = await pool.query(`
      SELECT
        COUNT(*)::int AS users,
        COUNT(*) FILTER (WHERE btrim(email) = '')::int AS blanks,
        COUNT(*) FILTER (WHERE email <> lower(btrim(email)))::int AS noncanonical
      FROM public.users
    `);
    const duplicates = await pool.query(`
      SELECT lower(btrim(email)) AS normalized_email,
             COUNT(*)::int AS account_count,
             COUNT(DISTINCT tenant_id)::int AS tenant_count
      FROM public.users
      GROUP BY lower(btrim(email))
      HAVING COUNT(*) > 1
      ORDER BY lower(btrim(email))
    `);
    const uniquenessObject = await pool.query(`
      SELECT index_relation.relname,
             index_relation.relkind,
             table_constraint.conname,
             table_constraint.contype
      FROM pg_catalog.pg_class AS index_relation
      JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.oid = index_relation.relnamespace
      LEFT JOIN pg_catalog.pg_constraint AS table_constraint
        ON table_constraint.conindid = index_relation.oid
      WHERE namespace.nspname = 'public'
        AND index_relation.relname = 'users_tenant_id_email_key'
    `);
    const migrationState = await pool.query(`
      SELECT migration_name,
             finished_at IS NOT NULL AND rolled_back_at IS NULL AS applied
      FROM public._prisma_migrations
      WHERE migration_name = '20260903020000_global_normalized_email_login'
    `);

    process.stdout.write(
      `Global normalized-email preflight: ${JSON.stringify({
        ...summary.rows[0],
        duplicate_groups: duplicates.rowCount,
        duplicates: duplicates.rows,
        current_uniqueness_object: uniquenessObject.rows,
        migration: migrationState.rows,
      })}\n`,
    );
    if (Number(summary.rows[0].blanks) > 0 || duplicates.rowCount > 0) {
      process.exitCode = 2;
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  process.stderr.write(`Global normalized-email preflight FAIL: ${error.message}\n`);
  process.exitCode = 1;
});

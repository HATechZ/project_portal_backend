require('dotenv').config({ quiet: true });
const { Pool } = require('pg');

// Read-only. Reports what app_user actually holds on the Organization-module
// tables, so stale "blocked on grants" notes can be confirmed or cleared.
async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
  });
  const tables = [
    'companies',
    'company_types',
    'divisions',
    'division_types',
    'division_leads',
    'members',
    'teams',
    'team_members',
  ];
  try {
    const { rows } = await pool.query(
      `SELECT table_name,
              string_agg(privilege_type, ', ' ORDER BY privilege_type) privileges
         FROM information_schema.role_table_grants
        WHERE grantee = current_user
          AND table_schema = 'public'
          AND table_name = ANY($1::text[])
        GROUP BY table_name
        ORDER BY table_name`,
      [tables],
    );
    const held = new Map(rows.map(r => [r.table_name, r.privileges]));
    for (const table of tables) {
      console.log(table.padEnd(16), held.get(table) ?? 'NO GRANTS');
    }
  } finally {
    await pool.end();
  }
}
main().catch(error => {
  console.error(error.code || error.name, error.message);
  process.exitCode = 1;
});

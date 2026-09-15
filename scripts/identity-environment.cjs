require('dotenv').config({ quiet: true });
const { Pool } = require('pg');
async function main() {
  for (const key of ['DATABASE_URL', 'DATABASE_URL_MIGRATION', 'DATABASE_URL_PRIVILEGED', 'REDIS_URL']) {
    console.log(key, Boolean(process.env[key]));
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
  try {
    console.log('Database reachable', (await pool.query('SELECT current_user')).rows[0]);
    console.log('Identity grants', (await pool.query(`SELECT table_name, string_agg(privilege_type, ', ' ORDER BY privilege_type) privileges FROM information_schema.role_table_grants WHERE grantee=current_user AND table_schema='public' AND table_name IN ('users','user_roles','actor_profiles','auth_sessions','auth_session_consumed_refresh_tokens','password_reset_tokens','workflow_action_role_permissions') GROUP BY table_name ORDER BY table_name`)).rows);
  }
  finally { await pool.end(); }
}
main().catch(error => { console.error(error.code || error.name); process.exitCode = 1; });

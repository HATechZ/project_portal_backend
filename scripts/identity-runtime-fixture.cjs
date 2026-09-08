require('dotenv').config({ quiet: true });
const { Pool } = require('pg');
const { randomUUID } = require('node:crypto');
const { hash } = require('bcryptjs');
const { ConfigService } = require('@nestjs/config');
const { PrismaService } = require('../dist/src/infra/prisma/prisma.service');
const { UnitOfWorkService } = require('../dist/src/infra/prisma/unit-of-work.service');
const { RequestContext } = require('../dist/src/common/context/request-context');

async function fixture() {
  const admin = new Pool({ connectionString: process.env.DATABASE_URL_MIGRATION, connectionTimeoutMillis: 10000 });
  const prisma = new PrismaService(new ConfigService({ database: { url: process.env.DATABASE_URL, privilegedUrl: process.env.DATABASE_URL_PRIVILEGED } }));
  const uow = new UnitOfWorkService(prisma);
  const tenantIds = [randomUUID(), randomUUID()];
  const password = 'Identity-Verification-Only-83!';
  const passwordHash = await hash(password, 4);
  const users = [];
  const roles = (await admin.query('SELECT id, code FROM roles')).rows;
  const run = (work, tenantId = tenantIds[0]) => RequestContext.run({ requestId: randomUUID(), tenantId }, work);
  async function createUser(tenantId = tenantIds[0]) {
    const id = randomUUID();
    const email = `identity-${id}@example.invalid`;
    await admin.query('INSERT INTO users (id, tenant_id, full_name, email, password_hash) VALUES ($1,$2,$3,$4,$5)', [id, tenantId, 'Identity verification', email, passwordHash]);
    const user = { id, tenantId, email, passwordHash }; users.push(user); return user;
  }
  async function cleanup() {
    // Only this run's random Tenant IDs; no schema or existing account changes.
    for (const table of ['auth_session_consumed_refresh_tokens', 'auth_sessions', 'password_reset_tokens', 'actor_profiles', 'user_roles', 'workflow_action_role_permissions', 'users']) {
      await admin.query(`DELETE FROM ${table} WHERE tenant_id = ANY($1::uuid[])`, [tenantIds]);
    }
    await admin.query('DELETE FROM tenants WHERE id = ANY($1::uuid[])', [tenantIds]);
    const remaining = await admin.query('SELECT count(*)::int n FROM tenants WHERE id = ANY($1::uuid[])', [tenantIds]);
    if (remaining.rows[0].n !== 0) throw new Error('Temporary Tenant cleanup failed');
  }
  async function close() { await prisma.onModuleDestroy(); await admin.end(); }
  try {
    for (const id of tenantIds) await admin.query('INSERT INTO tenants (id,name,slug) VALUES ($1,$2,$3)', [id,'Temporary identity verification',`identity-${id}`]);
  } catch (error) { await cleanup(); await close(); throw error; }
  return { admin, prisma, uow, tenantIds, users, password, passwordHash, roles, run, createUser, cleanup, close };
}
module.exports = { fixture };

require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { Pool } = require('pg');
const { randomUUID } = require('node:crypto');
const { host } = require('./identity-http-host.cjs');

async function main() {
  const admin = new Pool({ connectionString: process.env.DATABASE_URL_MIGRATION, connectionTimeoutMillis: 10000 });
  const runId = randomUUID(), tenantIds = [], emails = [];
  const typeIds = [randomUUID(), randomUUID()];
  let h, cleanup = false;
  const checks = [];
  const blockers = [];
  const password = 'Company-Verification-Only-83!';
  const payload = (type, label) => {
    const email = `company-${runId}-${label}@example.invalid`;
    emails.push(email);
    return { company: { name: `Company verification ${runId} ${label}`, abbr: 'VERIFY', companyTypeId: type }, admin: { fullName: 'Verification admin', email, password, confirmPassword: password, country: 'Bangladesh', phone: '+88012345678' }, termsAccepted: true };
  };
  try {
    for (const [index, id] of typeIds.entries()) await admin.query('INSERT INTO company_types (id,name) VALUES ($1,$2)', [id, `Verification ${runId} ${index}`]);
    h = await host(); const { call } = h;
    const types = (await call('GET', '/company-type', 200)).data.filter(x => typeIds.includes(x.id));
    assert(types.length >= 2, 'Two existing CompanyTypes required to verify retype');
    const first = payload(types[0].id, 'a'), second = payload(types[0].id, 'b');
    for (const field of ['company', 'admin']) for (const value of [undefined, null, []]) {
      await call('POST', '/company/signup', 400, { body: { ...first, [field]: value }, label: `/company/signup (${field} ${value === undefined ? 'missing' : JSON.stringify(value)})` });
    }
    for (const confirmPassword of [undefined, 'mismatch']) await call('POST', '/company/signup', 400, { body: { ...first, admin: { ...first.admin, confirmPassword } }, label: '/company/signup (invalid confirmation)' });
    const a = (await call('POST', '/company/signup', 201, { body: first, label: '/company/signup (Tenant A)' })).data;
    const b = (await call('POST', '/company/signup', 201, { body: second, label: '/company/signup (Tenant B)' })).data;
    const tenants = await admin.query('SELECT id,tenant_id FROM companies WHERE id = ANY($1::uuid[])', [[a.company.id, b.company.id]]);
    tenantIds.push(...tenants.rows.map(x => x.tenant_id));
    const tenantB = tenants.rows.find(x => x.id === b.company.id).tenant_id;
    const login = async (email) => (await call('POST', '/auth/login', 200, { body: { email, password }, label: '/auth/login (email only)' })).data.tokens.accessToken;
    const token = await login(first.admin.email), foreign = await login(second.admin.email);
    const auth = { token };
    const list = (await call('GET', '/company?page=1&limit=1', 200, auth)).data;
    assert.deepEqual(list.items.map(x => x.id), [a.company.id]); assert.equal(list.meta.total, 1);
    assert.equal((await call('GET', '/company?page=2&limit=1', 200, auth)).data.items.length, 0);
    await call('GET', '/company?page=0', 400, auth);
    const detail = async () => (await call('GET', `/company/${a.company.id}`, 200, { ...auth, label: '/company/:id (own)' })).data;
    assert.equal((await detail()).workspaceSlug, a.company.workspaceSlug);
    const canUpdate = (await admin.query("SELECT has_table_privilege('app_user','public.companies','UPDATE') AS allowed")).rows[0].allowed;
    if (!canUpdate) {
      blockers.push('app_user lacks UPDATE on public.companies; valid rename/retype returns 500. No grant applied.');
      for (const body of [{ name: ' Renamed verification ' }, { companyTypeId: types[1].id }]) {
        await call('PATCH', `/company/${a.company.id}`, 500, { ...auth, tenantId: tenantB, body, label: '/company/:id (valid update blocked by UPDATE privilege)' });
        Object.assign(h.rows[h.rows.length - 1], { result: 'FAIL', expectedStatus: 200 });
      }
    } else {
    const renamed = (await call('PATCH', `/company/${a.company.id}`, 200, { ...auth, tenantId: tenantB, body: { name: ' Renamed verification ' }, label: '/company/:id (rename, foreign header ignored)' })).data;
    assert.equal(renamed.name, 'Renamed verification'); assert.equal(renamed.workspaceSlug, a.company.workspaceSlug);
    const retyped = (await call('PATCH', `/company/${a.company.id}`, 200, { ...auth, body: { companyTypeId: types[1].id }, label: '/company/:id (retype)' })).data;
    assert.equal(retyped.companyTypeId, types[1].id); assert.equal(retyped.name, renamed.name); assert.equal(retyped.abbr, 'VERIFY'); assert.equal(retyped.workspaceSlug, a.company.workspaceSlug);
    checks.push('Successful rename/retype preserve slug, abbreviation and omitted fields');
    }
    const before = await detail();
    for (const body of [{}, { name: null }, { name: ' ' }, { name: 'x'.repeat(181) }, { companyTypeId: null }, { companyTypeId: 'bad' }, { companyTypeId: randomUUID() }, { workspaceSlug: 'override' }, { tenantId: tenantB }, { isActive: false }, { abbr: 'NEW' }]) {
      await call('PATCH', `/company/${a.company.id}`, 400, { ...auth, body, label: '/company/:id (invalid/immutable update)' });
    }
    assert.deepEqual(await detail(), before); checks.push('Rejected updates leave persisted Company unchanged');
    for (const method of ['GET', 'PATCH']) {
      const body = method === 'PATCH' ? { name: 'Cross Tenant attack' } : undefined;
      await call(method, `/company/${a.company.id}`, 401, { body, label: '/company/:id (no token)' });
      await call(method, '/company/bad', 400, { ...auth, body, label: '/company/bad' });
      await call(method, `/company/${randomUUID()}`, 404, { ...auth, body, label: '/company/:id (missing)' });
      await call(method, `/company/${b.company.id}`, 404, { ...auth, body, tenantId: tenantB, label: '/company/:id (foreign target/header)' });
      await call(method, `/company/${a.company.id}`, 404, { token: foreign, body, label: '/company/:id (reverse isolation)' });
    }
    await call('GET', '/company', 401);
    assert.deepEqual((await call('GET', '/company', 200, { token: foreign })).data.items.map(x => x.id), [b.company.id]);
    // Change only this temporary second administrator's fixture role, then authenticate normally.
    const ordinaryRole = (await admin.query("SELECT id FROM roles WHERE code='division_member'")).rows[0].id;
    await admin.query('UPDATE user_roles SET role_id=$1 WHERE user_id=$2', [ordinaryRole, b.admin.id]);
    await admin.query('UPDATE actor_profiles SET role_id=$1 WHERE user_id=$2', [ordinaryRole, b.admin.id]);
    const ordinary = await login(second.admin.email);
    await call('GET', '/company', 403, { token: ordinary });
    await call('GET', `/company/${b.company.id}`, 403, { token: ordinary, label: '/company/:id (ordinary role)' });
    await call('PATCH', `/company/${b.company.id}`, 403, { token: ordinary, body: { name: 'Denied' }, label: '/company/:id (ordinary role)' });
    await call('POST', '/company', 404, { ...auth, body: first.company, label: '/company (retired create)' });
    const failedName = `Company verification ${runId} rollback`;
    await call('POST', '/company/signup', 409, { body: { ...first, company: { ...first.company, name: failedName } }, label: '/company/signup (duplicate admin email rolls back)' });
    await call('POST', '/company/signup', 400, { body: { ...first, company: { ...first.company, name: failedName, companyTypeId: randomUUID() } }, label: '/company/signup (unknown type)' });
    assert.equal((await admin.query('SELECT count(*)::int n FROM companies WHERE name=$1', [failedName])).rows[0].n, 0);
    assert.equal((await admin.query('SELECT count(*)::int n FROM tenants WHERE name=$1', [failedName])).rows[0].n, 0);
    assert.equal((await admin.query('SELECT count(*)::int n FROM users WHERE email = ANY($1::text[])', [emails])).rows[0].n, 2);
    checks.push('Duplicate-email failure after Tenant/Company insert rolls back workspace; unknown type creates nothing');
    assert.equal((await admin.query('SELECT count(*)::int n FROM companies WHERE tenant_id = ANY($1::uuid[])', [tenantIds])).rows[0].n, 2);
    checks.push('Exactly one Company per signup Tenant; two-way Tenant isolation');
    await call('POST', '/auth/logout', 204, auth);
  } finally {
    if (h) await h.app.close();
    // Discover successful fixtures even if an assertion failed immediately after signup.
    const discovered = await admin.query('SELECT DISTINCT tenant_id FROM users WHERE email = ANY($1::text[])', [emails]);
    const ids = [...new Set([...tenantIds, ...discovered.rows.map(x => x.tenant_id)])];
    for (const table of ['auth_session_consumed_refresh_tokens', 'auth_sessions', 'password_reset_tokens', 'actor_profiles', 'user_roles', 'workflow_action_role_permissions', 'users', 'companies']) {
      await admin.query(`DELETE FROM ${table} WHERE tenant_id = ANY($1::uuid[])`, [ids]);
    }
    await admin.query('DELETE FROM tenants WHERE id = ANY($1::uuid[])', [ids]);
    await admin.query('DELETE FROM company_types WHERE id = ANY($1::uuid[])', [typeIds]);
    assert.equal((await admin.query('SELECT count(*)::int n FROM tenants WHERE id = ANY($1::uuid[])', [ids])).rows[0].n, 0);
    cleanup = true; await admin.end();
  }
  fs.writeFileSync('specs/04-organization/http-evidence.json', JSON.stringify({ executedAt: new Date().toISOString(), databaseRole: 'app_user', host: 'Production AppModule; background workers/throttler disabled, uncached Redis reads, mail capture; fixture setup/inspection/cleanup uses maintenance connection', cleanup, checks, blockers, requests: h.rows }, null, 2) + '\n');
  console.log(`Company HTTP: ${h.rows.length} curl requests; ${blockers.length} blockers; rollback/isolation/cleanup PASS`);
  if (blockers.length) process.exitCode = 1;
}
main().catch(error => { console.error(error.name, error.message); process.exitCode = 1; });

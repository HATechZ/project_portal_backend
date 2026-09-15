const { Pool } = require('pg');
require('dotenv').config({ quiet: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function call(path, options = {}) {
  const response = await fetch(`http://127.0.0.1:3000/api/v1${path}`, options);
  let body = null;
  try {
    body = await response.json();
  } catch {
    // 204 responses intentionally have no body.
  }
  return {
    status: response.status,
    requestId: response.headers.get('x-request-id'),
    body,
  };
}

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const connectionString = process.env.DATABASE_URL_MIGRATION;
  assert(email && password, 'Seed administrator credentials are required');
  assert(connectionString, 'DATABASE_URL_MIGRATION is required');

  const pool = new Pool({ connectionString });
  let tenantId;
  try {
    const identity = await pool.query(
      `SELECT app_user.tenant_id
       FROM public.users AS app_user
       WHERE app_user.email = lower(trim($1))`,
      [email],
    );
    assert(identity.rowCount === 1, 'Seed administrator was not found');
    tenantId = identity.rows[0].tenant_id;
  } finally {
    await pool.end();
  }

  const login = await call('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert(login.status === 200, `Login returned ${login.status}`);
  const accessToken = login.body?.data?.tokens?.accessToken;
  assert(typeof accessToken === 'string', 'Login access token missing');
  const headers = {
    authorization: `Bearer ${accessToken}`,
    'x-tenant-id': tenantId,
  };

  const profiles = await call('/actor-profiles', { headers });
  assert(profiles.status === 200, `ActorProfile list returned ${profiles.status}`);
  const actors = profiles.body?.data;
  assert(Array.isArray(actors) && actors.length > 0, 'No ActorProfile returned');
  const selected = actors.find((actor) => actor.isDefault) ?? actors[0];

  const activate = await call(`/actor-profiles/${selected.id}/activate`, {
    method: 'POST',
    headers,
  });
  assert(activate.status === 200, `ActorProfile activation returned ${activate.status}`);
  assert(activate.body?.data?.id === selected.id, 'Wrong ActorProfile activated');

  const current = await call('/auth/me', { headers });
  assert(current.status === 200, `Current User returned ${current.status}`);

  const logout = await call('/auth/logout', { method: 'POST', headers });
  assert(logout.status === 204, `Logout returned ${logout.status}`);
  const rejected = await call('/auth/me', { headers });
  assert(rejected.status === 401, 'Revoked session remained active');

  process.stdout.write(
    `${JSON.stringify({
      login: login.status,
      loginRequestId: Boolean(login.requestId),
      actorProfileList: profiles.status,
      profileCount: actors.length,
      roleCode: selected.roleCode,
      roleOnly:
        selected.memberId === null && selected.clientContactId === null,
      actorProfileActivate: activate.status,
      currentUser: current.status,
      logout: logout.status,
      postLogout: rejected.status,
    })}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`Identity completion HTTP verification FAIL: ${error.message}\n`);
  process.exitCode = 1;
});

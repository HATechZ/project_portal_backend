require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { host } = require('./identity-http-host.cjs');

async function main() {
  const admin = new Pool({
    connectionString: process.env.DATABASE_URL_MIGRATION,
    connectionTimeoutMillis: 10000,
  });
  const runId = randomUUID();
  const emails = [];
  const tenantIds = [];
  const typeId = randomUUID();
  let h;
  let cleanup = false;
  const checks = [];
  const blockers = [];
  const password = 'Division-Verification-Only-83!';
  const payload = label => {
    const email = `division-${runId}-${label}@example.invalid`;
    emails.push(email);
    return {
      company: {
        name: `Division verification ${runId} ${label}`,
        abbr: `DV${label.toUpperCase()}`,
        companyTypeId: typeId,
      },
      admin: {
        fullName: 'Division verification admin',
        email,
        password,
        confirmPassword: password,
        country: 'Bangladesh',
        phone: '+88012345678',
      },
      termsAccepted: true,
    };
  };

  try {
    await admin.query('INSERT INTO company_types (id,name) VALUES ($1,$2)', [
      typeId,
      `Division verification ${runId}`,
    ]);
    h = await host();
    const { call } = h;
    const first = payload('a');
    const second = payload('b');
    const a = (await call('POST', '/company/signup', 201, {
      body: first,
      label: '/company/signup (Tenant A)',
    })).data;
    const b = (await call('POST', '/company/signup', 201, {
      body: second,
      label: '/company/signup (Tenant B)',
    })).data;
    const tenants = await admin.query(
      'SELECT id,tenant_id FROM companies WHERE id = ANY($1::uuid[])',
      [[a.company.id, b.company.id]],
    );
    tenantIds.push(...tenants.rows.map(row => row.tenant_id));
    const tokenA = (await call('POST', '/auth/login', 200, {
      body: { email: first.admin.email, password },
      label: '/auth/login (Tenant A)',
    })).data.tokens.accessToken;
    const tokenB = (await call('POST', '/auth/login', 200, {
      body: { email: second.admin.email, password },
      label: '/auth/login (Tenant B)',
    })).data.tokens.accessToken;
    const authA = { token: tokenA };

    await call('GET', '/division', 401, { label: '/division (no token)' });
    await call('POST', '/division', 400, {
      ...authA,
      body: { name: ' ', abbr: 'ENG' },
      label: '/division (blank name)',
    });
    await call('POST', '/division', 400, {
      ...authA,
      body: { name: 'Engineering', abbr: 'ENG', companyId: a.company.id },
      label: '/division (ownership override)',
    });
    await call('POST', '/division', 400, {
      ...authA,
      body: {
        name: 'Engineering',
        abbr: 'ENG',
        divisionTypeId: randomUUID(),
      },
      label: '/division (unknown type)',
    });

    const created = (await call('POST', '/division', 201, {
      ...authA,
      body: { name: ' Engineering ', abbr: ' ENG ' },
      label: '/division (create)',
    })).data;
    assert.equal(created.name, 'Engineering');
    assert.equal(created.abbr, 'ENG');
    assert.equal(created.divisionTypeId, null);
    assert(!('tenantId' in created));
    assert(!('companyId' in created));
    const list = (await call('GET', '/division?page=1&limit=1', 200, authA))
      .data;
    assert.deepEqual(list.items.map(row => row.id), [created.id]);
    const detail = (await call('GET', `/division/${created.id}`, 200, {
      ...authA,
      label: '/division/:id (own)',
    })).data;
    assert.equal(detail.id, created.id);
    const updated = (await call('PATCH', `/division/${created.id}`, 200, {
      ...authA,
      body: { name: ' Operations ' },
      label: '/division/:id (update)',
    })).data;
    assert.equal(updated.name, 'Operations');
    checks.push('Create/list/detail/update/delete pass through app_user Tenant scope');

    await call('GET', '/division/bad', 400, {
      ...authA,
      label: '/division/bad',
    });
    await call('GET', `/division/${randomUUID()}`, 404, {
      ...authA,
      label: '/division/:id (missing)',
    });
    await call('GET', `/division/${created.id}`, 404, {
      token: tokenB,
      label: '/division/:id (foreign)',
    });
    await call('PATCH', `/division/${created.id}`, 404, {
      token: tokenB,
      body: { name: 'Denied' },
      label: '/division/:id (foreign update)',
    });
    checks.push('Foreign Tenant Division access is indistinguishable from missing');

    const ordinaryRole = (await admin.query(
      "SELECT id FROM roles WHERE code='division_member'",
    )).rows[0].id;
    await admin.query('UPDATE user_roles SET role_id=$1 WHERE user_id=$2', [
      ordinaryRole,
      b.admin.id,
    ]);
    await admin.query('UPDATE actor_profiles SET role_id=$1 WHERE user_id=$2', [
      ordinaryRole,
      b.admin.id,
    ]);
    const ordinaryToken = (await call('POST', '/auth/login', 200, {
      body: { email: second.admin.email, password },
      label: '/auth/login (ordinary role)',
    })).data.tokens.accessToken;
    await call('GET', '/division', 403, {
      token: ordinaryToken,
      label: '/division (ordinary role)',
    });

    const dependent = (await call('POST', '/division', 201, {
      ...authA,
      body: { name: 'Dependent', abbr: 'DEP' },
      label: '/division (dependent create)',
    })).data;
    await admin.query(
      `INSERT INTO teams (tenant_id,id,company_id,division_id,name)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        tenantIds[0],
        randomUUID(),
        a.company.id,
        dependent.id,
        `Division verification ${runId}`,
      ],
    );
    await call('DELETE', `/division/${dependent.id}`, 409, {
      ...authA,
      label: '/division/:id (dependency)',
    });
    checks.push('Guarded hard delete refuses dependent Division');

    await call('PATCH', `/division/${created.id}`, 400, {
      ...authA,
      body: {},
      label: '/division/:id (empty update)',
    });
    await call('DELETE', `/division/${created.id}`, 204, {
      ...authA,
      label: '/division/:id (delete)',
    });
    await call('GET', `/division/${created.id}`, 404, {
      ...authA,
      label: '/division/:id (deleted)',
    });
    await call('POST', '/auth/logout', 204, authA);
  } finally {
    if (h) await h.app.close();
    const discovered = await admin.query(
      'SELECT DISTINCT tenant_id FROM users WHERE email = ANY($1::text[])',
      [emails],
    );
    const ids = [
      ...new Set([...tenantIds, ...discovered.rows.map(row => row.tenant_id)]),
    ];
    for (const table of [
      'auth_session_consumed_refresh_tokens',
      'auth_sessions',
      'password_reset_tokens',
      'actor_profiles',
      'user_roles',
      'workflow_action_role_permissions',
      'team_members',
      'teams',
      'divisions',
      'users',
      'companies',
    ]) {
      await admin.query(`DELETE FROM ${table} WHERE tenant_id = ANY($1::uuid[])`, [
        ids,
      ]);
    }
    await admin.query('DELETE FROM tenants WHERE id = ANY($1::uuid[])', [ids]);
    await admin.query('DELETE FROM company_types WHERE id=$1', [typeId]);
    assert.equal(
      (await admin.query('SELECT count(*)::int n FROM tenants WHERE id = ANY($1::uuid[])', [
        ids,
      ])).rows[0].n,
      0,
    );
    cleanup = true;
    await admin.end();
  }
  fs.writeFileSync(
    'specs/04.1-division/http-evidence.json',
    `${JSON.stringify(
      {
        executedAt: new Date().toISOString(),
        databaseRole: 'app_user',
        host: 'Production AppModule; background workers/throttler disabled, uncached Redis reads, mail capture; fixture setup/inspection/cleanup uses maintenance connection',
        cleanup,
        checks,
        blockers,
        requests: h.rows,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Division HTTP: ${h.rows.length} curl requests; cleanup PASS`);
}

main().catch(error => {
  console.error(error.name, error.message);
  process.exitCode = 1;
});

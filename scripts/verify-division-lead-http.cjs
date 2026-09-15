require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { host } = require('./identity-http-host.cjs');

// Gate 5 walkthrough for 04.1.1 Division Lead Multiplicity.
// Proves the two rules the schema alone cannot: a Member may lead Divisions it
// does not belong to, and a Division keeps at most one active Lead.

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
  const password = 'Division-Lead-Verification-91!';

  const signup = label => {
    const email = `divlead-${runId}-${label}@example.invalid`;
    emails.push(email);
    return {
      company: {
        name: `Division Lead verification ${runId} ${label}`,
        abbr: `DL${label.toUpperCase()}`,
        companyTypeId: typeId,
      },
      admin: {
        fullName: 'Division Lead verification admin',
        email,
        password,
        confirmPassword: password,
        country: 'Bangladesh',
        phone: '+88012345678',
      },
      termsAccepted: true,
    };
  };

  // Members are fixture data, not the subject under test: insert them on the
  // maintenance connection so the walkthrough exercises only lead routes.
  const insertMember = async (tenantId, companyId, divisionId, userId, tag) => {
    const id = randomUUID();
    await admin.query(
      `INSERT INTO members (tenant_id,id,user_id,company_id,division_id,name,email,role_title,is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)`,
      [
        tenantId,
        id,
        userId,
        companyId,
        divisionId,
        `Division Lead member ${tag}`,
        `divlead-${runId}-member-${tag}@example.invalid`,
        'Verification member',
      ],
    );
    return id;
  };

  const activeLeadRows = async (tenantId, memberId) =>
    (
      await admin.query(
        'SELECT division_id FROM division_leads WHERE tenant_id=$1 AND member_id=$2 AND revoked_at IS NULL ORDER BY division_id',
        [tenantId, memberId],
      )
    ).rows.map(row => row.division_id);

  try {
    await admin.query('INSERT INTO company_types (id,name) VALUES ($1,$2)', [
      typeId,
      `Division Lead verification ${runId}`,
    ]);
    h = await host();
    const { call } = h;

    const first = signup('a');
    const second = signup('b');
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
    const tenantOf = Object.fromEntries(
      tenants.rows.map(row => [row.id, row.tenant_id]),
    );
    tenantIds.push(...Object.values(tenantOf));
    const tenantA = tenantOf[a.company.id];

    const tokenA = (await call('POST', '/auth/login', 200, {
      body: { email: first.admin.email, password },
      label: '/auth/login (Tenant A)',
    })).data.tokens.accessToken;
    const tokenB = (await call('POST', '/auth/login', 200, {
      body: { email: second.admin.email, password },
      label: '/auth/login (Tenant B)',
    })).data.tokens.accessToken;
    const authA = { token: tokenA };

    // Four Divisions: HOME (the Member's own), ALPHA + BETA (led), SOLO (stays Lead-less).
    const division = async (name, abbr) =>
      (await call('POST', '/division', 201, {
        ...authA,
        body: { name, abbr },
        label: `/division (create ${abbr})`,
      })).data;
    const home = await division('Lead Home', 'LHOME');
    const alpha = await division('Lead Alpha', 'LALPHA');
    const beta = await division('Lead Beta', 'LBETA');
    const solo = await division('Lead Solo', 'LSOLO');

    const memberOne = await insertMember(
      tenantA,
      a.company.id,
      home.id,
      a.admin.id,
      'one',
    );
    const memberTwo = await insertMember(
      tenantA,
      a.company.id,
      home.id,
      a.admin.id,
      'two',
    );
    const memberNoUser = await insertMember(
      tenantA,
      a.company.id,
      home.id,
      null,
      'nouser',
    );

    // --- Unauthenticated / malformed / unauthorized -------------------------
    await call('PUT', `/division/${alpha.id}/lead`, 401, {
      body: { memberId: memberOne },
      label: '/division/:id/lead (no token)',
    });
    await call('PUT', `/division/${alpha.id}/lead`, 400, {
      ...authA,
      body: { memberId: 'not-a-uuid' },
      label: '/division/:id/lead (bad memberId)',
    });
    await call('GET', '/division/bad/lead', 400, {
      ...authA,
      label: '/division/bad/lead',
    });

    // --- AC-E01: assign to a Division the Member does NOT belong to ---------
    const assigned = (await call('PUT', `/division/${alpha.id}/lead`, 200, {
      ...authA,
      body: { memberId: memberOne },
      label: '/division/:id/lead (assign, non-home Division)',
    })).data;
    assert.equal(assigned.division.id, alpha.id);
    assert.equal(assigned.member.id, memberOne);
    assert.equal(assigned.idempotent, false);
    assert.equal(assigned.revokedIncumbent, null);
    assert.notEqual(alpha.id, home.id);
    checks.push('A Member leads a Division it does not belong to');

    // --- AC-E02: the same Member leads a SECOND Division --------------------
    const secondLead = (await call('PUT', `/division/${beta.id}/lead`, 200, {
      ...authA,
      body: { memberId: memberOne },
      label: '/division/:id/lead (assign second Division)',
    })).data;
    assert.equal(secondLead.revokedIncumbent, null);
    assert.deepEqual(
      await activeLeadRows(tenantA, memberOne),
      [alpha.id, beta.id].sort(),
    );
    checks.push('One Member holds active Lead rows for two Divisions');

    // --- idempotent re-assign: no write -------------------------------------
    const repeat = (await call('PUT', `/division/${beta.id}/lead`, 200, {
      ...authA,
      body: { memberId: memberOne },
      label: '/division/:id/lead (idempotent re-assign)',
    })).data;
    assert.equal(repeat.idempotent, true);
    assert.equal(repeat.revokedIncumbent, null);
    checks.push('Re-assigning the sitting Lead is an idempotent no-op');

    // --- AC-E03: a new Lead revokes the incumbent ---------------------------
    const replaced = (await call('PUT', `/division/${alpha.id}/lead`, 200, {
      ...authA,
      body: { memberId: memberTwo },
      label: '/division/:id/lead (replace incumbent)',
    })).data;
    assert.equal(replaced.revokedIncumbent.member.id, memberOne);
    assert(replaced.revokedIncumbent.revokedAt);
    assert.deepEqual(await activeLeadRows(tenantA, memberOne), [beta.id]);
    assert.equal(
      (
        await admin.query(
          'SELECT count(*)::int n FROM division_leads WHERE tenant_id=$1 AND division_id=$2 AND revoked_at IS NULL',
          [tenantA, alpha.id],
        )
      ).rows[0].n,
      1,
    );
    checks.push('Assigning a new Lead revokes the incumbent, leaving exactly one');

    // --- reads ---------------------------------------------------------------
    const lead = (await call('GET', `/division/${alpha.id}/lead`, 200, {
      ...authA,
      label: '/division/:id/lead (read)',
    })).data;
    assert.equal(lead.member.id, memberTwo);

    const ledDivisions = (await call(
      'GET',
      `/member/${memberOne}/divisions`,
      200,
      { ...authA, label: '/member/:id/divisions' },
    )).data;
    assert.deepEqual(ledDivisions.map(row => row.id), [beta.id]);
    checks.push('Member led-Divisions read returns only active rows');

    // --- DR-10: a Lead-less Division is valid, not a 404 --------------------
    const none = (await call('GET', `/division/${solo.id}/lead`, 200, {
      ...authA,
      label: '/division/:id/lead (Lead-less)',
    })).data;
    assert.equal(none, null);
    await call('DELETE', `/division/${solo.id}/lead`, 404, {
      ...authA,
      label: '/division/:id/lead (revoke, none active)',
    });
    checks.push('A Lead-less Division reads as null and revokes as 404');

    // --- AC-W01: Member without linked User ---------------------------------
    await call('PUT', `/division/${solo.id}/lead`, 409, {
      ...authA,
      body: { memberId: memberNoUser },
      label: '/division/:id/lead (Member has no User)',
    });
    assert.equal(
      (
        await admin.query(
          'SELECT count(*)::int n FROM division_leads WHERE tenant_id=$1 AND division_id=$2',
          [tenantA, solo.id],
        )
      ).rows[0].n,
      0,
    );

    // --- AC-W02: revoke, then re-assign the same Member ---------------------
    const revoked = (await call('DELETE', `/division/${beta.id}/lead`, 200, {
      ...authA,
      label: '/division/:id/lead (revoke)',
    })).data;
    assert.equal(revoked.member.id, memberOne);
    assert.deepEqual(await activeLeadRows(tenantA, memberOne), []);
    const reassigned = (await call('PUT', `/division/${beta.id}/lead`, 200, {
      ...authA,
      body: { memberId: memberOne },
      label: '/division/:id/lead (re-assign after revoke)',
    })).data;
    assert.equal(reassigned.idempotent, false);
    assert.deepEqual(await activeLeadRows(tenantA, memberOne), [beta.id]);
    checks.push('A Member revoked from a Division can be re-assigned to it');

    // --- Tenant isolation ----------------------------------------------------
    await call('GET', `/division/${alpha.id}/lead`, 404, {
      token: tokenB,
      label: '/division/:id/lead (foreign Tenant read)',
    });
    await call('PUT', `/division/${alpha.id}/lead`, 404, {
      token: tokenB,
      body: { memberId: memberOne },
      label: '/division/:id/lead (foreign Tenant assign)',
    });
    checks.push('Foreign Tenant lead access is indistinguishable from missing');

    // --- 403: a role holding neither ASSIGN_LEADER nor system_admin ---------
    const ordinaryRole = (
      await admin.query("SELECT id FROM roles WHERE code='division_member'")
    ).rows[0].id;
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
    await call('GET', `/division/${alpha.id}/lead`, 403, {
      token: ordinaryToken,
      label: '/division/:id/lead (ordinary role)',
    });
    checks.push('A role without ASSIGN_LEADER is refused the lead routes');

    // --- DR-11: lead rows block Division hard delete ------------------------
    await call('DELETE', `/division/${alpha.id}`, 409, {
      ...authA,
      label: '/division/:id (delete blocked by lead rows)',
    });
    checks.push('Division hard delete is refused while lead history exists');

    await call('POST', '/auth/logout', 204, authA);
  } catch (error) {
    blockers.push(`${error.name}: ${error.message}`);
    throw error;
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
      'division_leads',
      'actor_profiles',
      'user_roles',
      'workflow_action_role_permissions',
      'team_members',
      'teams',
      'members',
      'divisions',
      'users',
      'companies',
    ]) {
      await admin.query(
        `DELETE FROM ${table} WHERE tenant_id = ANY($1::uuid[])`,
        [ids],
      );
    }
    await admin.query('DELETE FROM tenants WHERE id = ANY($1::uuid[])', [ids]);
    await admin.query('DELETE FROM company_types WHERE id=$1', [typeId]);
    assert.equal(
      (
        await admin.query(
          'SELECT count(*)::int n FROM tenants WHERE id = ANY($1::uuid[])',
          [ids],
        )
      ).rows[0].n,
      0,
    );
    cleanup = true;
    await admin.end();
  }

  fs.writeFileSync(
    'specs/04.1.1-division-lead-multiplicity/http-evidence.json',
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
  console.log(
    `Division Lead HTTP: ${h.rows.length} curl requests; cleanup PASS`,
  );
}

main().catch(error => {
  console.error(error.name, error.message);
  process.exitCode = 1;
});

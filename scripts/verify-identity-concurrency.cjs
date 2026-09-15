const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { fixture } = require('./identity-runtime-fixture.cjs');
const { AuthSessionRepository } = require('../dist/src/auth/repositories/auth-session.repository');
const { PasswordRecoveryRepository } = require('../dist/src/auth/repositories/password-recovery.repository');
const { ActorProfileRepository } = require('../dist/src/auth/repositories/actor-profile.repository');
const { SessionAdministrationRepository } = require('../dist/src/auth/repositories/session-administration.repository');
const { RolePermissionRepository } = require('../dist/src/role-permission/repositories/role-permission.repository');
const { RoleAssignmentRepository } = require('../dist/src/role-permission/repositories/role-assignment.repository');
const { UserRepository } = require('../dist/src/user/repositories/user.repository');
const { mapPrismaException } = require('../dist/src/common/exceptions/prisma-exception.map');
const { fingerprint } = require('./verify-identity-evidence.cjs');

async function main() {
  const f = await fixture();
  const results = [];
  const sessions = new AuthSessionRepository(f.uow), recovery = new PasswordRecoveryRepository(f.uow);
  const roles = new RolePermissionRepository(f.uow), assignments = new RoleAssignmentRepository(f.uow);
  const actors = new ActorProfileRepository(f.uow), users = new UserRepository(f.uow);
  const revocation = new SessionAdministrationRepository(f.uow);
  const tenantId = f.tenantIds[0];
  const sessionInput = userId => ({ id: randomUUID(), userId, refreshTokenHash: randomUUID(), expiresAt: new Date(Date.now()+60000), absoluteExpiresAt: new Date(Date.now()+120000) });
  const query = (sql, args=[]) => f.admin.query(sql,args);
  const race = async promises => {
    const settled = await Promise.allSettled(promises);
    if (!settled.some(x => x.status === 'fulfilled')) console.error(settled.map(x=>x.reason?.message));
    assert(settled.some(x => x.status === 'fulfilled'));
    for (const item of settled) if (item.status === 'rejected') assert.equal(mapPrismaException(item.reason)?.getStatus(),409, item.reason.code);
    return settled.map(x => x.status === 'fulfilled' ? 'committed' : '409');
  };
  const record = (name, detail) => { results.push({name, result:'PASS', detail}); console.log('PASS',name,JSON.stringify(detail)); };
  try {
    const user = await f.createUser();
    const member = f.roles.find(x=>x.code==='division_member'), lead=f.roles.find(x=>x.code==='division_lead'), adminRole=f.roles.find(x=>x.code==='system_admin');
    const assignmentRace = await race([1,2].map(()=>f.run(()=>assignments.ensureAssignment(user.id,member.id,user.id))));
    assert.equal((await query('SELECT count(*)::int n FROM actor_profiles WHERE user_id=$1',[user.id])).rows[0].n,1);
    assert.equal((await query('SELECT count(*)::int n FROM user_roles WHERE user_id=$1 AND revoked_at IS NULL',[user.id])).rows[0].n,1);
    record('assignment-idempotency',assignmentRace);
    const actions=(await query('SELECT code FROM workflow_action_definitions ORDER BY code LIMIT 2')).rows.map(x=>x.code);
    assert.equal(actions.length,2);
    const permissionRace=await race(actions.map(code=>f.run(()=>roles.replaceRolePermissions(member.id,[code]))));
    assert.equal((await query('SELECT count(*)::int n FROM workflow_action_role_permissions WHERE tenant_id=$1 AND role_id=$2 AND allowed',[tenantId,member.id])).rows[0].n,1);
    record('permission-replacement',permissionRace);
    await f.run(()=>assignments.ensureAssignment(user.id,lead.id,user.id));
    const profiles=await f.run(()=>actors.findForUser(user.id));
    const switches=await race(profiles.map(p=>f.run(()=>actors.setDefault(p.id,user.id))));
    assert.equal((await query('SELECT count(*)::int n FROM actor_profiles WHERE user_id=$1 AND is_default',[user.id])).rows[0].n,1);
    record('actor-profile-switching',switches);
    const assignment=await f.run(()=>roles.findActiveAssignment(user.id,lead.id));
    const target=profiles.find(p=>p.roleId===lead.id);
    const revokeSwitch=await race([f.run(()=>actors.setDefault(target.id,user.id)),f.run(()=>roles.revokeAssignment(assignment.id,lead.id,false))]);
    // Retry an aborted revocation, then prove that the retained profile cannot authorize.
    await f.run(()=>roles.revokeAssignment(assignment.id,lead.id,false));
    assert.equal(await f.run(()=>actors.setDefault(target.id,user.id)),null);
    const actor=await f.run(()=>sessions.findActiveActor(user.id));
    assert.notEqual(actor?.role.id,lead.id);
    record('role-revocation',revokeSwitch);

    const deactivation=await race([
      f.run(()=>sessions.recordLoginAndCreateSession(user.id,sessionInput(user.id),f.passwordHash)),
      f.run(()=>users.update(user.id,{isActive:false},{deactivating:true,passwordChanged:false})),
    ]);
    await f.run(()=>users.update(user.id,{isActive:false},{deactivating:true,passwordChanged:false}));
    assert.equal(await f.run(()=>sessions.recordLoginAndCreateSession(user.id,sessionInput(user.id),f.passwordHash)),null);
    assert.equal((await query('SELECT count(*)::int n FROM auth_sessions WHERE user_id=$1 AND revoked_at IS NULL',[user.id])).rows[0].n,0);
    record('deactivation-login',deactivation);
    await f.run(()=>users.update(user.id,{isActive:true},{deactivating:false,passwordChanged:false}));
    const logins=await Promise.all([1,2].map(()=>f.run(()=>sessions.recordLoginAndCreateSession(user.id,sessionInput(user.id),f.passwordHash))));
    assert(logins.every(Boolean));
    const loginCount=(await query('SELECT count(*)::int n FROM auth_sessions WHERE user_id=$1 AND revoked_at IS NULL',[user.id])).rows[0].n;
    assert.equal(loginCount,2);
    assert((await query('SELECT last_login_at FROM users WHERE id=$1',[user.id])).rows[0].last_login_at);
    record('login-session-creation',{sessions:loginCount});
    // Database constraint failure must roll back lastLoginAt as well as session creation.
    const before=(await query('SELECT last_login_at FROM users WHERE id=$1',[user.id])).rows[0].last_login_at;
    await assert.rejects(f.run(()=>sessions.recordLoginAndCreateSession(user.id,{...sessionInput(user.id),refreshTokenHash:'x'.repeat(256)},f.passwordHash)));
    const after=(await query('SELECT last_login_at FROM users WHERE id=$1',[user.id])).rows[0].last_login_at;
    assert.equal(before.toISOString(),after.toISOString());
    record('login-atomic-rollback',true);
    await f.run(()=>revocation.revokeForUser(user.id));
    assert.equal((await query('SELECT count(*)::int n FROM auth_sessions WHERE user_id=$1 AND revoked_at IS NULL',[user.id])).rows[0].n,0);
    record('operator-session-revocation',true);
    const hashes=[randomUUID(),randomUUID()];
    await Promise.all(hashes.map(h=>f.run(()=>recovery.replacePasswordResetToken(user.id,h,new Date(Date.now()+60000)))));
    const valid=(await query('SELECT token_hash FROM password_reset_tokens WHERE user_id=$1 AND used_at IS NULL',[user.id])).rows;
    assert.equal(valid.length,1);
    const latest=valid[0].token_hash, old=hashes.find(x=>x!==latest);
    assert.equal(await f.run(()=>recovery.resetPassword(old,'unusable')),false);
    await f.run(()=>sessions.recordLoginAndCreateSession(user.id,sessionInput(user.id),f.passwordHash));
    const resets=await Promise.all([1,2].map(()=>f.run(()=>recovery.resetPassword(latest,'new-password-hash'))));
    assert.deepEqual(resets.sort(),[false,true]);
    assert.equal(await f.run(()=>sessions.recordLoginAndCreateSession(user.id,sessionInput(user.id),f.passwordHash)),null);
    assert.equal((await query('SELECT count(*)::int n FROM auth_sessions WHERE user_id=$1 AND revoked_at IS NULL',[user.id])).rows[0].n,0);
    record('password-recovery-races',{liveTokens:valid.length,resetWinners:resets.filter(Boolean).length});
    const expired=randomUUID();
    await f.run(()=>recovery.replacePasswordResetToken(user.id,expired,new Date(Date.now()-1000)));
    assert.equal(await f.run(()=>recovery.resetPassword(expired,'bad')),false);
    assert.equal(await f.run(()=>recovery.resetPassword(latest,'bad')),false);
    record('expired-used-superseded-tokens',true);

    // Final-admin protection must count active Users, not inactive retained grants.
    const a=await f.createUser(), b=await f.createUser();
    await f.run(()=>assignments.ensureAssignment(a.id,adminRole.id,a.id));
    await f.run(()=>assignments.ensureAssignment(b.id,adminRole.id,a.id));
    const grant=await f.run(()=>roles.findActiveAssignment(a.id,adminRole.id));
    await f.run(()=>users.update(b.id,{isActive:false},{deactivating:true,passwordChanged:false}));
    assert.equal(await f.run(()=>roles.revokeAssignment(grant.id,adminRole.id,true)),false);
    record('last-active-admin',true);
  } finally {
    await f.cleanup(); record('cleanup',true); await f.close();
  }
  fs.writeFileSync('specs/03-identity-and-access/concurrency-evidence.json',JSON.stringify({executedAt:new Date().toISOString(),fingerprint:fingerprint(),databaseRole:'app_user',results},null,2)+'\n');
}
main().catch(e=>{console.error(e.name, e.message, e.stack?.split('\n').filter(x=>x.includes('verify-identity-concurrency')).join('\n'));process.exitCode=1;});

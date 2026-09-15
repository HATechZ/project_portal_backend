const assert=require('node:assert/strict');
const fs=require('node:fs');
const {randomUUID}=require('node:crypto');
const {fixture}=require('./identity-runtime-fixture.cjs');
const {host}=require('./identity-http-host.cjs');
async function main() {
  const f=await fixture(); let h; let cleaned=false;
  try {
    const a=await f.createUser(), b=await f.createUser(f.tenantIds[1]), ordinary=await f.createUser();
    const adminRole=f.roles.find(x=>x.code==='system_admin'), memberRole=f.roles.find(x=>x.code==='division_member');
    // Fixture setup only: application actor writes still need owner privileges.
    // All tested HTTP requests use production repositories under app_user/RLS.
    for(const [user,role] of [[a,adminRole],[b,adminRole],[ordinary,memberRole]]) {
      user.actorId=randomUUID();
      await f.admin.query('INSERT INTO user_roles (id,tenant_id,user_id,role_id) VALUES ($1,$2,$3,$4)',[randomUUID(),user.tenantId,user.id,role.id]);
      await f.admin.query('INSERT INTO actor_profiles (id,tenant_id,user_id,role_id,label,is_default) VALUES ($1,$2,$3,$4,$5,true)',[user.actorId,user.tenantId,user.id,role.id,'Temporary verification profile']);
    }
    h=await host();const {call}=h;
    const login=async user=>(await call('POST','/auth/login',200,{body:{email:user.email,password:f.password},label:'/auth/login (email/password only)'})).data.tokens;
    const ta=await login(a),tb=await login(b),tu=await login(ordinary);
    const auth={token:ta.accessToken},foreign={token:tb.accessToken},normal={token:tu.accessToken};
    assert.equal((await call('GET','/auth/me',200,auth)).data.id,a.id);
    assert.equal((await call('GET','/auth/me',200,{...auth,tenantId:b.tenantId,label:'/auth/me (foreign header ignored)'})).data.id,a.id);
    assert.equal((await call('GET','/auth/me',200,{...auth,tenantId:'malformed',label:'/auth/me (malformed header ignored)'})).data.id,a.id);
    const list=await call('GET','/user',200,auth);
    const listText=JSON.stringify(list.data);assert(listText.includes(a.id));assert(!listText.includes(b.id));
    await call('GET',`/user/${a.id}`,200,{...auth,label:'/user/:id (own Tenant)'});
    await call('GET',`/user/${b.id}`,404,{...auth,tenantId:b.tenantId,label:'/user/:id (foreign object and header)'});
    await call('GET',`/user/${a.id}`,404,{...foreign,tenantId:a.tenantId,label:'/user/:id (reverse cross-Tenant)'});
    await call('GET','/role',200,auth);await call('GET',`/role/${adminRole.id}`,200,{...auth,label:'/role/:id'});
    await call('GET',`/user/${a.id}/role`,200,{...auth,label:'/user/:userId/role'});
    await call('GET',`/user/${b.id}/role`,404,{...auth,label:'/user/:userId/role (cross-Tenant)'});
    const profiles=(await call('GET','/actor-profiles',200,auth)).data;
    assert.deepEqual(profiles.map(x=>x.id),[a.actorId]);
    await call('POST',`/actor-profiles/${b.actorId}/activate`,403,{...auth,tenantId:b.tenantId,label:'/actor-profiles/:id/activate (foreign owner)'});
    await call('GET','/user',403,normal);await call('GET','/role',403,normal);await call('GET','/actor-profiles',200,normal);
    await call('GET','/auth/me',401,{tenantId:a.tenantId,label:'/auth/me (header without token)'});
    const parts=ta.accessToken.split('.');
    const payload=JSON.parse(Buffer.from(parts[1],'base64url').toString());payload.tenantId=b.tenantId;
    parts[1]=Buffer.from(JSON.stringify(payload)).toString('base64url');
    await call('GET','/auth/me',401,{token:parts.join('.'),tenantId:b.tenantId,label:'/auth/me (forged JWT Tenant)'});
    await call('DELETE',`/auth/users/${b.id}/sessions`,404,{...auth,tenantId:b.tenantId,label:'/auth/users/:userId/sessions (foreign target)'});
    await call('GET','/auth/me',200,foreign);
    await call('POST','/auth/logout',204,{...auth,tenantId:b.tenantId,label:'/auth/logout (foreign header ignored)'});
    await call('GET','/auth/me',401,{...auth,label:'/auth/me (logged out)'});
    await call('POST','/auth/refresh',401,{tenantId:a.tenantId,body:{refreshToken:ta.refreshToken},label:'/auth/refresh (logged-out session)'});
    await call('GET','/auth/me',200,foreign);
    await call('POST','/auth/logout',204,foreign);
    await call('GET','/auth/me',401,foreign);
    await call('POST','/auth/refresh',400,{body:{refreshToken:tu.refreshToken},label:'/auth/refresh (header still required)'});
    await call('POST','/auth/logout',204,normal);
  } finally {
    if(h) await h.app.close();
    await f.cleanup(); cleaned=true; await f.close();
  }
  const report={executedAt:new Date().toISOString(),databaseRole:'app_user',host:'Production AppModule; background jobs/throttler disabled, uncached Tenant reads, mail capture; temporary profiles seeded only as fixtures',cleanup:cleaned,requests:h.rows};
  fs.writeFileSync('specs/03-identity-and-access/authenticated-tenant-evidence.json',JSON.stringify(report,null,2)+'\n');
  console.log(`Authenticated Tenant HTTP PASS: ${h.rows.length} curl requests; cleanup PASS`);
}
main().catch(e=>{console.error(e.name,e.message);process.exitCode=1;});

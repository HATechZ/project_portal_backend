const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
function fingerprint() {
  const files=[];
  function walk(dir) { for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    const name=path.join(dir,entry.name);
    if(entry.isDirectory()) walk(name); else if(name.endsWith('.ts') && !name.endsWith('.spec.ts')) files.push(name);
  } }
  for(const dir of ['src/auth','src/user','src/role-permission','src/common/exceptions']) walk(dir);
  const hash=createHash('sha256');
  for(const file of files.sort()) hash.update(file.replaceAll('\\','/')).update(fs.readFileSync(file,'utf8').replaceAll('\r\n','\n'));
  return hash.digest('hex');
}
function verify(kind) {
  const root='specs/03-identity-and-access/';
  if(kind==='contracts') {
    const data=fs.readFileSync(root+'DATA_CONTRACT.md','utf8');
    assert(data.includes('auth_session_consumed_refresh_tokens') && data.includes('absoluteExpiresAt'));
    assert(fs.readFileSync(root+'API_CONTRACT.md','utf8').includes('/api/v1/auth/users/:userId/sessions'));
    return;
  }
  const report=JSON.parse(fs.readFileSync(root+kind+'-evidence.json','utf8'));
  assert.equal(report.fingerprint,fingerprint(),'Evidence is stale for current identity source');
  assert(report.results.length>0 && report.results.every(x=>x.result==='PASS'));
  assert(report.results.some(x=>x.name==='cleanup'));
  const required=kind==='concurrency' ? ['permission-replacement','actor-profile-switching','role-revocation','deactivation-login','login-session-creation','password-recovery-races','last-active-admin'] : ['ordinary-user-provisioning','admin-session-revocation','cross-tenant','refresh-replay','recovery-failure','all-routes'];
  for(const name of required) assert(report.results.some(x=>x.name===name),`Missing ${name}`);
}
module.exports={fingerprint,verify};
if(require.main===module) { verify(process.argv[2]); console.log('Identity evidence PASS',process.argv[2]); }

const assert = require('node:assert/strict');
const evidence = require('../specs/04-organization/http-evidence.json');
assert.equal(evidence.cleanup, true, 'Fixture cleanup must pass');
assert.equal(evidence.databaseRole, 'app_user');
const updates = evidence.requests.filter(row => row.method === 'PATCH' && row.status === 200);
assert(updates.length >= 2, 'Successful live rename and retype are not verified');
assert(evidence.checks.includes('Successful rename/retype preserve slug, abbreviation and omitted fields'));
if (process.argv[2] !== '--update') {
  assert.equal(evidence.blockers.length, 0, 'Runtime blockers remain');
  assert(evidence.requests.length >= 40);
  assert(evidence.requests.every(row => row.result === 'PASS' && row.requestId === 'echoed'));
  for (const method of ['GET', 'POST', 'PATCH']) assert(evidence.requests.some(row => row.method === method));
}
console.log('Recorded Company HTTP evidence passes');

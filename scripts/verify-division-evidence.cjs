const assert = require('node:assert/strict');
const evidence = require('../specs/04.1-division/http-evidence.json');

assert.equal(evidence.cleanup, true, 'Fixture cleanup must pass');
assert.equal(evidence.databaseRole, 'app_user');
assert.equal(evidence.blockers.length, 0, 'Runtime blockers remain');
assert(evidence.requests.length >= 20, 'Division walkthrough is incomplete');
assert(evidence.requests.every(row => row.result === 'PASS'));
assert(evidence.requests.every(row => row.requestId === 'echoed'));

for (const method of ['POST', 'GET', 'PATCH', 'DELETE']) {
  assert(evidence.requests.some(row => row.method === method), `${method} was not exercised`);
}
for (const status of [200, 201, 204, 400, 401, 403, 404, 409]) {
  assert(evidence.requests.some(row => row.status === status), `${status} was not exercised`);
}
for (const check of [
  'Create/list/detail/update/delete pass through app_user Tenant scope',
  'Foreign Tenant Division access is indistinguishable from missing',
  'Guarded hard delete refuses dependent Division',
]) {
  assert(evidence.checks.includes(check), `${check} is missing`);
}

console.log('Recorded Division HTTP evidence passes');

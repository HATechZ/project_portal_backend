const assert = require('node:assert/strict');
const evidence = require('../specs/04.1.1-division-lead-multiplicity/http-evidence.json');

assert.equal(evidence.cleanup, true, 'Fixture cleanup must pass');
assert.equal(evidence.databaseRole, 'app_user');
assert.equal(evidence.blockers.length, 0, 'Runtime blockers remain');
assert(evidence.requests.length >= 25, 'Division Lead walkthrough is incomplete');
assert(evidence.requests.every(row => row.result === 'PASS'));
assert(evidence.requests.every(row => row.requestId === 'echoed'));

for (const method of ['GET', 'PUT', 'DELETE']) {
  assert(
    evidence.requests.some(row => row.method === method),
    `${method} was not exercised`,
  );
}
for (const status of [200, 400, 401, 403, 404, 409]) {
  assert(
    evidence.requests.some(row => row.status === status),
    `${status} was not exercised`,
  );
}
for (const check of [
  'A Member leads a Division it does not belong to',
  'One Member holds active Lead rows for two Divisions',
  'Re-assigning the sitting Lead is an idempotent no-op',
  'Assigning a new Lead revokes the incumbent, leaving exactly one',
  'Member led-Divisions read returns only active rows',
  'A Lead-less Division reads as null and revokes as 404',
  'A Member revoked from a Division can be re-assigned to it',
  'Foreign Tenant lead access is indistinguishable from missing',
  'A role without ASSIGN_LEADER is refused the lead routes',
  'Division hard delete is refused while lead history exists',
]) {
  assert(evidence.checks.includes(check), `${check} is missing`);
}

console.log('Recorded Division Lead HTTP evidence passes');

const fs = require('node:fs');

const source = fs.readFileSync('prisma/seed/data/permissions.data.ts', 'utf8');
const migration = fs.readFileSync(
  'prisma/migrations/20260903000000_company_workspace_onboarding/migration.sql',
  'utf8',
);

const commonBlock = source.match(/const commonCreate = \[([\s\S]*?)\];/);
if (!commonBlock) throw new Error('Cannot locate commonCreate permission source');
const codes = (text) => [
  ...text.matchAll(/WorkflowActionCode\.([A-Z][A-Z0-9_]*)/g),
].map((match) => match[1]);
const common = codes(commonBlock[1]);

const roleMatrixBlock = source.match(
  /export const rolePermissionCodes:[\s\S]*?=\s*\{([\s\S]*?)\n  \};/,
);
if (!roleMatrixBlock) throw new Error('Cannot locate role permission matrix');
const roles = [
  ...roleMatrixBlock[1].matchAll(/^    ([a-z_]+): (?:\[|supervisorPermissions)/gm),
].map((match) => match[1]);
if (roles.length === 0) throw new Error('Role permission matrix is empty');

const supervisorSource = source.match(
  /const supervisorPermissions =[\s\S]*?code !== WorkflowActionCode\.([A-Z][A-Z0-9_]*)[\s\S]*?\);/,
);
const supervisorSql = migration.match(
  /WHEN 'system_admin'::public\.actor_role_code THEN\s*action_definition\.code <> '([A-Z][A-Z0-9_]*)'::public\.workflow_action_code/,
);
if (!supervisorSource || !supervisorSql) {
  throw new Error('Cannot resolve system_admin permission rule');
}
if (supervisorSource[1] !== supervisorSql[1]) {
  throw new Error(
    `system_admin drift: source excludes ${supervisorSource[1]}, SQL excludes ${supervisorSql[1]}`,
  );
}

for (const role of roles.filter((code) => code !== 'system_admin')) {
  const sourceBlock = source.match(new RegExp(`${role}: \\[([\\s\\S]*?)\\n    \\]`));
  if (!sourceBlock) throw new Error(`Cannot locate seed matrix for ${role}`);
  const expected = new Set(codes(sourceBlock[1]));
  if (sourceBlock[1].includes('...commonCreate')) {
    for (const code of common) expected.add(code);
  }

  const sqlBlock = migration.match(
    new RegExp(`WHEN '${role}'::public\\.actor_role_code THEN([\\s\\S]*?)(?=\\n      WHEN|\\n      ELSE)`),
  );
  if (!sqlBlock) throw new Error(`Cannot locate onboarding SQL matrix for ${role}`);
  const actual = new Set([...sqlBlock[1].matchAll(/'([A-Z][A-Z0-9_]*)'/g)].map((match) => match[1]));
  const missing = [...expected].filter((code) => !actual.has(code));
  const extra = [...actual].filter((code) => !expected.has(code));
  if (missing.length || extra.length) {
    throw new Error(`${role} drift: missing=[${missing}] extra=[${extra}]`);
  }
}

if (/app_relay/.test(migration)) throw new Error('Onboarding migration must not reference app_relay');

console.log('Onboarding SQL permission matrix matches permissions.data.ts.');

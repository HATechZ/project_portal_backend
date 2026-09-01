import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const schema = readFileSync(resolve('prisma/schema.prisma'), 'utf8');
const constants = readFileSync(
  resolve('src/common/tenant/tenant.constants.ts'),
  'utf8',
);

const scopedModels = [...schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)]
  .filter(([, , body]) => /^\s*tenantId\s+/m.test(body))
  .map(([, name]) => name)
  .sort();

const setBody = constants.match(
  /TENANT_SCOPED_MODELS\s*=\s*new Set<string>\(\[([\s\S]*?)\]\)/,
)?.[1];

if (!setBody) {
  throw new Error('Unable to parse TENANT_SCOPED_MODELS');
}

const declaredModels = [...setBody.matchAll(/'([^']+)'/g)]
  .map(([, name]) => name)
  .sort();

const missing = scopedModels.filter((name) => !declaredModels.includes(name));
const extra = declaredModels.filter((name) => !scopedModels.includes(name));

if (missing.length > 0 || extra.length > 0) {
  console.error('TENANT_SCOPED_MODELS does not match prisma/schema.prisma.');
  if (missing.length > 0) console.error(`Missing: ${missing.join(', ')}`);
  if (extra.length > 0) console.error(`Extra: ${extra.join(', ')}`);
  process.exit(1);
}

console.log(`Tenant scope verified: ${scopedModels.length} models.`);

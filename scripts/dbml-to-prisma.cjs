const fs = require('node:fs');

const input = fs.readFileSync('project_portal_workflow_management_erd.dbml', 'utf8');

function cleanSource(source) {
  let result = source.replace(/\/\*[\s\S]*?\*\//g, '');
  result = result.replace(/Note:\s*'''[\s\S]*?'''/g, '');
  return result;
}

function pascal(value) {
  return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
}

function singular(value) {
  if (value.endsWith('priorities')) return `${value.slice(0, -3)}y`;
  if (value.endsWith('statuses')) return value.slice(0, -2);
  if (value.endsWith('categories')) return `${value.slice(0, -3)}y`;
  if (value.endsWith('companies')) return `${value.slice(0, -3)}y`;
  if (value.endsWith('deliveries')) return `${value.slice(0, -3)}y`;
  if (value.endsWith('policies')) return `${value.slice(0, -3)}y`;
  if (value.endsWith('types')) return value.slice(0, -1);
  if (value.endsWith('details')) return value.slice(0, -1);
  if (value.endsWith('values')) return value.slice(0, -1);
  if (value.endsWith('sses')) return value.slice(0, -2);
  if (value.endsWith('s')) return value.slice(0, -1);
  return value;
}

function camel(value) {
  const name = pascal(value);
  return name.charAt(0).toLowerCase() + name.slice(1);
}

function modelName(table) { return pascal(singular(table)); }
function enumName(name) { return pascal(name); }

const source = cleanSource(input);
const enums = new Map();
const enumPattern = /Enum\s+(\w+)\s*\{([\s\S]*?)\}/g;
for (const match of source.matchAll(enumPattern)) {
  enums.set(match[1], match[2].split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
}

const tables = new Map();
const tablePattern = /Table\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
for (const match of source.matchAll(tablePattern)) {
  const table = { name: match[1], columns: [], indexes: [], relations: [] };
  const lines = match[2].split(/\r?\n/);
  let inIndexes = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('Note:')) continue;
    if (line === 'indexes {') { inIndexes = true; continue; }
    if (inIndexes && line === '}') { inIndexes = false; continue; }
    if (inIndexes) {
      const index = line.match(/^\(([^)]+)\)(?:\s+\[([^\]]+)\])?/);
      const single = line.match(/^(\w+)(?:\s+\[([^\]]+)\])?/);
      const parsed = index ?? single;
      if (parsed) table.indexes.push({ fields: parsed[1].split(',').map((v) => v.trim()), unique: (parsed[2] ?? '').includes('unique') });
      continue;
    }
    const column = line.match(/^(\w+)\s+([^\s\[]+)(?:\s+\[([^\]]+)\])?$/);
    if (!column) continue;
    const attributes = column[3] ?? '';
    table.columns.push({
      name: column[1], type: column[2], required: attributes.includes('not null'),
      primary: /(^|,)\s*pk\s*(,|$)/.test(attributes), unique: /(^|,)\s*unique\s*(,|$)/.test(attributes),
      default: attributes.match(/default:\s*(`[^`]+`|'[^']*'|[^,\]]+)/)?.[1]?.trim(),
    });
  }
  tables.set(table.name, table);
}

const refs = [];
const refPattern = /^Ref(?:\s+(\w+))?:\s+(\([^\r\n]+\)|\w+\.\w+)\s*([><-])\s*(\([^\r\n]+\)|\w+\.\w+)(?:\s+\[([^\]]+)\])?/gm;
function parseRefEndpoint(endpoint) {
  const fields = endpoint.trim().replace(/^\(|\)$/g, '').split(',').map((field) => field.trim());
  const parsed = fields.map((field) => field.match(/^(\w+)\.(\w+)$/));
  if (parsed.some((field) => !field)) throw new Error(`Invalid ref endpoint ${endpoint}`);
  const table = parsed[0][1];
  if (parsed.some((field) => field[1] !== table)) throw new Error(`Mixed-table ref endpoint ${endpoint}`);
  return { table, fields: parsed.map((field) => field[2]) };
}
for (const match of source.matchAll(refPattern)) {
  const from = parseRefEndpoint(match[2]);
  const to = parseRefEndpoint(match[4]);
  if (from.fields.length !== to.fields.length) throw new Error(`Mismatched composite ref ${match[0]}`);
  const settings = new Map();
  for (const setting of (match[5] ?? '').split(',')) {
    const parsed = setting.trim().match(/^(delete|update):\s*(cascade|restrict|set null|no action)$/i);
    if (parsed) settings.set(parsed[1].toLowerCase(), parsed[2].toLowerCase());
  }
  refs.push({
    name: match[1], fromTable: from.table, fromFields: from.fields, kind: match[3],
    toTable: to.table, toFields: to.fields, onDelete: settings.get('delete'),
    onUpdate: settings.get('update'),
  });
}

function prismaReferentialAction(action) {
  return ({ cascade: 'Cascade', restrict: 'Restrict', 'set null': 'SetNull', 'no action': 'NoAction' })[action];
}

for (const ref of refs) {
  const from = tables.get(ref.fromTable);
  const to = tables.get(ref.toTable);
  if (!from || !to) throw new Error(`Invalid ref ${JSON.stringify(ref)}`);
  const usesPrismaDefaultRelationName =
    ref.toTable === 'tenants' ||
    (ref.fromTable === 'auth_session_consumed_refresh_tokens' && ref.toTable === 'auth_sessions');
  const primaryFromField = ref.fromFields[0];
  const relationName = ref.name ?? (usesPrismaDefaultRelationName ? undefined : pascal(`${ref.fromTable}_${primaryFromField}_${ref.toTable}`));
  const foreignKeys = ref.fromFields.map((field) => from.columns.find((column) => column.name === field));
  if (foreignKeys.some((field) => !field)) throw new Error(`Missing FK in ${ref.fromTable}.(${ref.fromFields.join(', ')})`);
  let forwardName = camel(primaryFromField.replace(/_id$/, ''));
  if (from.columns.some((column) => camel(column.name) === forwardName)) forwardName += 'Relation';
  const usedForward = new Set(from.relations.map((relation) => relation.field));
  while (usedForward.has(forwardName)) forwardName += 'Relation';
  const relationArguments = [
    `fields: [${ref.fromFields.map(camel).join(', ')}]`,
    `references: [${ref.toFields.map(camel).join(', ')}]`,
  ];
  if (ref.onDelete) relationArguments.push(`onDelete: ${prismaReferentialAction(ref.onDelete)}`);
  if (ref.onUpdate) relationArguments.push(`onUpdate: ${prismaReferentialAction(ref.onUpdate)}`);
  const relationPrefix = relationName ? `"${relationName}", ` : '';
  from.relations.push({
    field: forwardName, type: modelName(ref.toTable), optional: foreignKeys.some((field) => !field.required),
    annotation: `@relation(${relationPrefix}${relationArguments.join(', ')})`,
  });
  let reverseName = ref.toTable === 'tenants'
    ? camel(ref.fromTable)
    : ref.fromTable === 'auth_session_consumed_refresh_tokens' && ref.toTable === 'auth_sessions'
      ? 'consumedRefreshTokens'
      : `${camel(ref.fromTable)}By${pascal(primaryFromField)}`;
  const usedReverse = new Set(to.relations.map((relation) => relation.field));
  while (usedReverse.has(reverseName)) reverseName += 'Relation';
  to.relations.push({
    field: reverseName, type: modelName(ref.fromTable), optional: ref.kind === '-', list: ref.kind !== '-',
    annotation: relationName ? `@relation("${relationName}")` : '',
  });
}

function prismaType(type) {
  if (enums.has(type)) return { type: enumName(type), native: '' };
  if (type === 'uuid') return { type: 'String', native: '@db.Uuid' };
  if (type === 'timestamp') return { type: 'DateTime', native: '@db.Timestamp(6)' };
  if (type === 'date') return { type: 'DateTime', native: '@db.Date' };
  if (type === 'text') return { type: 'String', native: '@db.Text' };
  if (type === 'boolean') return { type: 'Boolean', native: '' };
  if (type === 'int' || type === 'integer') return { type: 'Int', native: '' };
  if (type === 'bigint') return { type: 'BigInt', native: '' };
  if (type === 'jsonb') return { type: 'Json', native: '@db.JsonB' };
  const varchar = type.match(/^varchar\((\d+)\)$/);
  if (varchar) return { type: 'String', native: `@db.VarChar(${varchar[1]})` };
  const decimal = type.match(/^(?:decimal|numeric)\((\d+),(\d+)\)$/);
  if (decimal) return { type: 'Decimal', native: `@db.Decimal(${decimal[1]}, ${decimal[2]})` };
  throw new Error(`Unsupported DBML type: ${type}`);
}

function defaultAttribute(value, type) {
  if (value === undefined) return '';
  if (value === '`now()`') return '@default(now())';
  if (value === 'true' || value === 'false' || /^-?\d+(?:\.\d+)?$/.test(value)) return `@default(${value})`;
  if (value.startsWith("'") && value.endsWith("'")) return `@default(${JSON.stringify(value.slice(1, -1))})`;
  if (value.startsWith('`') && value.endsWith('`')) return `@default(dbgenerated(${JSON.stringify(value.slice(1, -1))}))`;
  if (enums.has(type)) return `@default(${value})`;
  return `@default(${value})`;
}

const out = [];
out.push('generator client {', '  provider     = "prisma-client"', '  output       = "../src/generated/prisma"', '  moduleFormat = "cjs"', '}', '', 'datasource db {', '  provider = "postgresql"', '}', '');

for (const [name, values] of enums) {
  out.push(`enum ${enumName(name)} {`);
  for (const value of values) out.push(`  ${value}`);
  out.push(`  @@map("${name}")`, '}', '');
}

for (const table of tables.values()) {
  out.push(`model ${modelName(table.name)} {`);
  for (const column of table.columns) {
    const mapped = prismaType(column.type);
    const attrs = [];
    if (column.primary) attrs.push('@id');
    if (column.unique) attrs.push('@unique');
    const defaultValue = defaultAttribute(column.default, column.type);
    if (defaultValue) attrs.push(defaultValue);
    if (mapped.native) attrs.push(mapped.native);
    attrs.push(`@map("${column.name}")`);
    out.push(`  ${camel(column.name)} ${mapped.type}${column.required || column.primary ? '' : '?'} ${attrs.join(' ')}`);
  }
  if (table.relations.length) {
    out.push('');
    for (const relation of table.relations) {
      out.push(`  ${relation.field} ${relation.type}${relation.list ? '[]' : relation.optional ? '?' : ''} ${relation.annotation}`.trimEnd());
    }
  }
  const scalarUnique = new Set(table.columns.filter((column) => column.unique).map((column) => column.name));
  for (const index of table.indexes) {
    if (index.fields.length === 1 && index.unique && scalarUnique.has(index.fields[0])) continue;
    out.push(`  @@${index.unique ? 'unique' : 'index'}([${index.fields.map(camel).join(', ')}])`);
  }
  out.push(`  @@map("${table.name}")`, '}', '');
}

while (out.at(-1) === '') out.pop();
fs.writeFileSync('prisma/schema.prisma', `${out.join('\n')}\n`);
console.log(`Generated ${tables.size} models, ${enums.size} enums, and ${refs.length} relations.`);

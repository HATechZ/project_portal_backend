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
for (const match of source.matchAll(/^Ref:\s+(\w+)\.(\w+)\s*([><-])\s*(\w+)\.(\w+)/gm)) {
  refs.push({ fromTable: match[1], fromField: match[2], kind: match[3], toTable: match[4], toField: match[5] });
}

for (const ref of refs) {
  const from = tables.get(ref.fromTable);
  const to = tables.get(ref.toTable);
  if (!from || !to) throw new Error(`Invalid ref ${JSON.stringify(ref)}`);
  const relationName = pascal(`${ref.fromTable}_${ref.fromField}_${ref.toTable}`);
  const fk = from.columns.find((column) => column.name === ref.fromField);
  if (!fk) throw new Error(`Missing FK ${ref.fromTable}.${ref.fromField}`);
  let forwardName = camel(ref.fromField.replace(/_id$/, ''));
  if (from.columns.some((column) => camel(column.name) === forwardName)) forwardName += 'Relation';
  const usedForward = new Set(from.relations.map((relation) => relation.field));
  while (usedForward.has(forwardName)) forwardName += 'Relation';
  from.relations.push({
    field: forwardName, type: modelName(ref.toTable), optional: !fk.required,
    annotation: `@relation("${relationName}", fields: [${camel(ref.fromField)}], references: [${camel(ref.toField)}])`,
  });
  let reverseName = `${camel(ref.fromTable)}By${pascal(ref.fromField)}`;
  const usedReverse = new Set(to.relations.map((relation) => relation.field));
  while (usedReverse.has(reverseName)) reverseName += 'Relation';
  to.relations.push({ field: reverseName, type: modelName(ref.fromTable), optional: ref.kind === '-', list: ref.kind !== '-', annotation: `@relation("${relationName}")` });
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
    for (const relation of table.relations) out.push(`  ${relation.field} ${relation.type}${relation.list ? '[]' : relation.optional ? '?' : ''} ${relation.annotation}`);
  }
  const scalarUnique = new Set(table.columns.filter((column) => column.unique).map((column) => column.name));
  for (const index of table.indexes) {
    if (index.fields.length === 1 && index.unique && scalarUnique.has(index.fields[0])) continue;
    out.push(`  @@${index.unique ? 'unique' : 'index'}([${index.fields.map(camel).join(', ')}])`);
  }
  out.push(`  @@map("${table.name}")`, '}', '');
}

fs.writeFileSync('prisma/schema.prisma', `${out.join('\n')}\n`);
console.log(`Generated ${tables.size} models, ${enums.size} enums, and ${refs.length} relations.`);

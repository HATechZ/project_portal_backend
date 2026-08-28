#!/usr/bin/env node
/**
 * verify-sdd — Gate 5 enforcement for Project Portal Spec-Driven Development.
 *
 * Governed by specs/RULES.md Article II: "A task is ticked on a command that
 * exits 0, never on intent."
 *
 * Scans every specs/**\/tasks.md, finds each leaf checkbox and its attached VERIFY:
 * line, and executes the assertion for tasks that are ticked. A ticked task whose
 * VERIFY command fails — or which has no VERIFY line at all — is a constitution
 * violation and fails the run.
 *
 *   node scripts/verify-sdd.mjs                 verify ticked tasks (default)
 *   node scripts/verify-sdd.mjs --all           also probe unticked tasks (never fails on them)
 *   node scripts/verify-sdd.mjs --module 03     restrict to specs dirs matching "03"
 *   node scripts/verify-sdd.mjs --strict        also fail on ticked tasks missing a VERIFY line
 *   node scripts/verify-sdd.mjs --spec          validate spec ARTIFACTS (Gates 1-3), executes nothing
 *   node scripts/verify-sdd.mjs --lint          structural check only, executes nothing
 *   node scripts/verify-sdd.mjs --hook          Claude Code PostToolUse entry point
 *
 * Exit 0 = every ticked assertion holds. Exit 1 = at least one claim is not true.
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const SPECS = join(ROOT, 'specs');
const TIMEOUT_MS = 180_000;

const argv = process.argv.slice(2);
const OPT = {
  all: argv.includes('--all'),
  strict: argv.includes('--strict'),
  lint: argv.includes('--lint'),
  hook: argv.includes('--hook'),
  spec: argv.includes('--spec'),
  file: (() => {
    const i = argv.indexOf('--file');
    return i !== -1 && argv[i + 1] ? argv[i + 1] : null;
  })(),
  module: (() => {
    const i = argv.indexOf('--module');
    return i !== -1 && argv[i + 1] ? argv[i + 1] : null;
  })(),
};

const C = process.stdout.isTTY
  ? { r: '\x1b[31m', g: '\x1b[32m', y: '\x1b[33m', b: '\x1b[34m', d: '\x1b[2m', B: '\x1b[1m', x: '\x1b[0m' }
  : { r: '', g: '', y: '', b: '', d: '', B: '', x: '' };

/** Recursively collect every tasks-style markdown file under specs/. */
function findTaskFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...findTaskFiles(full));
    } else if (/tasks\.md$/i.test(name) || /_TASKS\.md$/i.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const TASK_RE = /^(\s*)-\s\[([ xX])\]\s+(.*)$/;
const VERIFY_RE = /^\s*VERIFY:\s*(.+?)\s*$/;

/**
 * Parse one tasks.md into leaf tasks.
 * A task is a *leaf* when no deeper-indented task line follows it before a
 * sibling-or-shallower one. Group headers ("Phase 1: ...") are never asserted.
 */
function parseTasks(file) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const raw = [];

  for (let i = 0; i < lines.length; i++) {
    const m = TASK_RE.exec(lines[i]);
    if (!m) continue;
    const [, indent, mark, text] = m;

    // A VERIFY: line belongs to this task if it appears before the next task line.
    let verify = null;
    for (let j = i + 1; j < lines.length; j++) {
      if (TASK_RE.test(lines[j])) break;
      const v = VERIFY_RE.exec(lines[j]);
      if (v) {
        verify = v[1];
        break;
      }
    }

    raw.push({ line: i + 1, depth: indent.length, done: mark.toLowerCase() === 'x', text, verify });
  }

  // Mark leaves.
  for (let i = 0; i < raw.length; i++) {
    const next = raw[i + 1];
    raw[i].leaf = !(next && next.depth > raw[i].depth);
  }
  return raw.filter((t) => t.leaf);
}

function run(cmd) {
  try {
    const bashShell =
      process.platform === 'win32'
        ? existsSync('C:\\Program Files\\Git\\bin\\bash.exe')
          ? 'C:\\Program Files\\Git\\bin\\bash.exe'
          : 'bash'
        : 'bash';
    const stdout = execSync(cmd, {
      cwd: ROOT,
      shell: bashShell,
      encoding: 'utf8',
      timeout: TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, output: (stdout || '').trim() };
  } catch (err) {
    const out = [err.stdout, err.stderr].filter(Boolean).join('\n').trim();
    const why = err.signal === 'SIGTERM' ? `timed out after ${TIMEOUT_MS / 1000}s` : `exit ${err.status ?? '?'}`;
    return { ok: false, output: out, why };
  }
}

/**
 * Gate 0 (Constitution Art. I): no implementation may precede its SPEC.md.
 *
 * The implementation surface for a NestJS backend is the feature module. Every
 * `*.module.ts` under src/ (except the root AppModule) must be either mapped to an
 * existing spec directory or registered in specs/PLACEHOLDERS.md — and a registered
 * placeholder must still be inert (no persistence, cache, or repository wiring, and
 * within its line cap).
 */
const ROOT_MODULE = 'src/app.module.ts';
const LIVE_IMPORT_RE = /from\s+'[^']*(prisma|redis|repository|\.service)[^']*'/gi;

function findModuleFiles(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'generated' || name === 'node_modules') continue;
      findModuleFiles(full, out);
    } else if (/\.module\.ts$/.test(name)) {
      out.push(relative(ROOT, full).split(sep).join('/'));
    }
  }
  return out;
}

function verifyGate0() {
  const reg = join(SPECS, 'PLACEHOLDERS.md');
  const violations = [];
  let text;
  try {
    text = readFileSync(reg, 'utf8');
  } catch {
    return [{ what: 'specs/PLACEHOLDERS.md', why: 'registry is missing' }];
  }

  const rowRe = /^\|\s*`([^`]+)`\s*\|\s*`?([^`|]+?)`?\s*\|(?:\s*(\d+)\s*\|)?/gm;
  const placeholders = new Map();
  const specced = new Map();
  for (const m of text.matchAll(rowRe)) {
    const [, file, target, cap] = m;
    if (!file.startsWith('src/')) continue;
    if (cap) placeholders.set(file, { spec: target.trim(), cap: Number(cap) });
    else specced.set(file, target.trim());
  }

  // 1. Registered placeholders must exist, stay inert, and respect their cap.
  for (const [file, { cap }] of placeholders) {
    let src;
    try {
      src = readFileSync(join(ROOT, file), 'utf8');
    } catch {
      violations.push({ what: file, why: 'listed as a placeholder but the file does not exist' });
      continue;
    }
    const lines = src.split(/\r?\n/).length;
    if (lines > cap) {
      violations.push({
        what: file,
        why: `${lines} lines exceeds its declared cap of ${cap} — it is no longer a placeholder`,
      });
    }
    const live = [...src.matchAll(LIVE_IMPORT_RE)].map((m) => m[0]);
    if (live.length) {
      violations.push({
        what: file,
        why: `wires live infrastructure (${live.join(', ')}) — it is an implementation, so Gate 0 applies`,
      });
    }
  }

  // 2. Mapped spec directories must actually exist.
  for (const [file, spec] of specced) {
    try {
      if (!statSync(join(ROOT, spec)).isDirectory()) throw new Error();
    } catch {
      violations.push({ what: file, why: `maps to ${spec}, which does not exist` });
    }
  }

  // 3. Every feature module must be accounted for in one table or the other.
  for (const mod of findModuleFiles(join(ROOT, 'src'))) {
    if (mod === ROOT_MODULE) continue;
    if (!placeholders.has(mod) && !specced.has(mod)) {
      violations.push({
        what: mod,
        why: 'not in specs/PLACEHOLDERS.md — declare its spec or register it as a placeholder',
      });
    }
  }

  return violations;
}

/**
 * --lint : structural check only, executes nothing.
 * Catches the primary failure mode — a box ticked with no assertion behind it —
 * in milliseconds, so it is safe to run from an editor hook on every save.
 * The full `--strict` run stays the slow, authoritative gate.
 */
function lintMode() {
  const targets = OPT.file ? [join(ROOT, OPT.file)] : findTaskFiles(SPECS);
  const bad = [];
  for (const f of targets) {
    let tasks;
    try {
      tasks = parseTasks(f);
    } catch {
      continue;
    }
    const rel = relative(ROOT, f).split(sep).join('/');
    for (const t of tasks) {
      if (t.done && !t.verify) {
        bad.push({ at: `${rel}:${t.line}`, label: t.text.replace(/\*\*/g, '').trim() });
      }
    }
  }
  if (bad.length === 0) {
    console.log(`${C.g}SDD lint OK${C.x} ${C.d}— every ticked task carries a VERIFY: assertion.${C.x}`);
    return 0;
  }
  console.log(`\n${C.r}${C.B}SDD lint failed${C.x} — ${bad.length} task(s) ticked with no VERIFY: assertion.\n`);
  for (const b of bad) {
    console.log(`  ${C.r}✗${C.x} ${b.label}\n    ${C.d}${b.at}${C.x}`);
  }
  console.log(`
${C.y}Constitution Art. II:${C.x} a task is ticked on a command that exits 0, never on intent.
Add a VERIFY: line under the task, e.g.

    - [x] Route every Prisma error through the global filter
          VERIFY: test $(grep -rl "PrismaClientKnownRequestError" src --include=*.ts | grep -v "src/common/exceptions" | wc -l) -eq 0

Then prove it: ${C.B}yarn verify:sdd:strict${C.x}
`);
  return 1;
}

/**
 * --hook : Claude Code PostToolUse entry point. Reads the hook payload on stdin,
 * and if the edited file is a spec tasks list, lints it. Exits 2 (blocking error)
 * when a task was ticked with no assertion, so the agent is told to fix it.
 */
async function hookMode() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;

  let payload = {};
  try {
    payload = JSON.parse(raw || '{}');
  } catch {
    return 0; // unparseable payload is not the spec's problem
  }

  const file = payload?.tool_input?.file_path || payload?.tool_response?.filePath || '';
  if (!/specs[/\\].*tasks\.md$/i.test(file)) return 0;

  OPT.file = relative(ROOT, file.replace(/\\/g, '/')).split(sep).join('/');
  if (OPT.file.startsWith('..')) OPT.file = null; // outside the repo — lint everything

  const code = lintMode();
  if (code !== 0) {
    console.error(
      '\nBLOCKED by SDD Gate 5 (Constitution Art. II). A task was ticked with no VERIFY: ' +
        'assertion. Add one under each ticked task, then run `yarn verify:sdd:strict` to prove it.'
    );
    return 2;
  }
  return 0;
}

/**
 * --spec : validate a spec ARTIFACT before it is executed (Gates 1-3).
 * `--lint` only inspects ticked tasks, so a freshly written spec passes it trivially.
 * This checks the things that make a spec executable at all.
 */
function specMode() {
  // A spec directory is a numbered module dir, or any dir carrying a SPEC.md.
  // This excludes specs/rules/, which holds the rulebook articles, not a module.
  const dirs = readdirSync(SPECS)
    .filter((d) => {
      try {
        if (!statSync(join(SPECS, d)).isDirectory()) return false;
      } catch {
        return false;
      }
      return /^\d{2}-/.test(d) || existsSync(join(SPECS, d, 'SPEC.md'));
    })
    .filter((d) => (OPT.module ? d.toLowerCase().includes(OPT.module.toLowerCase()) : true));

  if (!dirs.length) {
    console.error(`${C.r}No spec directory matches "${OPT.module}".${C.x}`);
    return 1;
  }

  let bad = 0;
  const index = (() => {
    try {
      return readFileSync(join(SPECS, 'INDEX.md'), 'utf8');
    } catch {
      return '';
    }
  })();

  for (const d of dirs) {
    const dir = join(SPECS, d);
    const problems = [];

    for (const f of ['SPEC.md', 'plan.md', 'tasks.md']) {
      try {
        statSync(join(dir, f));
      } catch {
        problems.push(`missing Gate artifact: ${f}`);
      }
    }
    // Article III: a module binds to the data model, the HTTP surface, or both.
    // At least one contract document must exist.
    const hasData = existsSync(join(dir, 'DATA_CONTRACT.md'));
    const hasApi = existsSync(join(dir, 'API_CONTRACT.md'));
    if (!hasData && !hasApi) {
      problems.push('missing DATA_CONTRACT.md and API_CONTRACT.md (specs/rules/03-contracts.md — at least one is required)');
    }

    let tasks = [];
    try {
      tasks = parseTasks(join(dir, 'tasks.md'));
    } catch {
      /* reported above */
    }
    if (tasks.length === 0) problems.push('tasks.md defines no leaf tasks');
    for (const t of tasks) {
      if (!t.verify) {
        problems.push(
          `task has no VERIFY: assertion — tasks.md:${t.line} "${t.text.replace(/\*\*/g, '').trim().slice(0, 60)}"`
        );
      }
    }
    // INDEX lists a module either by directory path ("specs/03-identity/...") or by
    // its number in the table ("| **03** |"). Accept both.
    const num = /^(\d+)/.exec(d)?.[1];
    const token = num ? `**${num}**` : `**${d.toUpperCase()}**`;
    const listed = index.includes(d) || index.toUpperCase().includes(token.toUpperCase());
    if (index && !listed) problems.push('not listed in specs/INDEX.md (Art. VII)');

    const ticked = tasks.filter((t) => t.done).length;

    if (problems.length) {
      bad++;
      console.log(`${C.r}✗${C.x} ${C.B}${d}${C.x} ${C.d}(${tasks.length} leaf tasks, ${ticked} ticked)${C.x}`);
      for (const p of problems) console.log(`    ${C.r}·${C.x} ${p}`);
    } else {
      console.log(
        `${C.g}✓${C.x} ${C.B}${d}${C.x} ${C.d}(${tasks.length} leaf tasks, all with assertions, ${ticked} ticked)${C.x}`
      );
    }
  }

  console.log('');
  if (bad) {
    console.log(`${C.r}${C.B}${bad} spec(s) not ready to execute.${C.x}\n`);
    return 1;
  }
  console.log(`${C.g}${C.B}Spec check OK${C.x} — ready for Gate 4.\n`);
  return 0;
}

// ── main ────────────────────────────────────────────────────────────────────
if (OPT.spec) {
  process.exit(specMode());
}

if (OPT.hook) {
  process.exit(await hookMode());
}

if (OPT.lint) {
  process.exit(lintMode());
}

const gate0 = verifyGate0();
if (gate0.length) {
  console.log(`\n${C.B}Gate 0 — implementation may not precede its spec${C.x}  ${C.d}(Constitution Art. I)${C.x}\n`);
  for (const v of gate0) {
    console.log(`  ${C.r}✗${C.x} ${C.B}${v.what}${C.x}\n    ${C.d}${v.why}${C.x}`);
  }
  console.log(`\n${C.r}${C.B}FAILED${C.x} — Gate 0 violation. See specs/PLACEHOLDERS.md.\n`);
  process.exit(1);
}

let files = findTaskFiles(SPECS);
if (OPT.module) {
  const needle = OPT.module.toLowerCase();
  files = files.filter((f) => relative(SPECS, f).toLowerCase().includes(needle));
}

if (files.length === 0) {
  console.error(`${C.r}No tasks.md found${OPT.module ? ` matching "${OPT.module}"` : ''} under specs/.${C.x}`);
  process.exit(1);
}

console.log(`\n${C.B}Gate 5 — SDD verification${C.x}  ${C.d}(Constitution Art. II)${C.x}\n`);

const tally = { pass: 0, fail: 0, missing: 0, unticked: 0, probePass: 0 };
const failures = [];
/** First unticked leaf task in spec order — what an agent should pick up next. */
let nextUnticked = null;

for (const file of files) {
  const rel = relative(ROOT, file).split(sep).join('/');
  const tasks = parseTasks(file);
  if (tasks.length === 0) continue;

  const header = [];
  for (const t of tasks) {
    const label = t.text.replace(/\*\*/g, '').trim();
    const at = `${rel}:${t.line}`;

    if (!t.done) {
      tally.unticked++;
      nextUnticked ??= { file: rel, line: t.line, label };
      if (!OPT.all || !t.verify) continue;
      const r = run(t.verify);
      if (r.ok) tally.probePass++;
      header.push(`  ${r.ok ? `${C.y}○ READY${C.x}` : `${C.d}· todo ${C.x}`}  ${r.ok ? label : `${C.d}${label}${C.x}`}`);
      continue;
    }

    // Ticked task.
    if (!t.verify) {
      tally.missing++;
      header.push(`  ${C.y}? NO-VERIFY${C.x}  ${label}\n              ${C.d}${at} — ticked with no VERIFY: line${C.x}`);
      if (OPT.strict) failures.push({ at, label, why: 'ticked with no VERIFY: line', output: '' });
      continue;
    }

    const r = run(t.verify);
    if (r.ok) {
      tally.pass++;
      header.push(`  ${C.g}✓ PASS${C.x}      ${label}`);
    } else {
      tally.fail++;
      failures.push({ at, label, why: r.why, output: r.output, cmd: t.verify });
      header.push(`  ${C.r}✗ FAIL${C.x}      ${C.B}${label}${C.x}\n              ${C.d}${at}${C.x}`);
    }
  }

  if (header.length) {
    console.log(`${C.b}${rel}${C.x}`);
    console.log(header.join('\n'));
    console.log('');
  }
}

if (failures.length) {
  console.log(`${C.r}${C.B}Claims that do not hold${C.x}\n`);
  for (const f of failures) {
    console.log(`  ${C.r}✗${C.x} ${C.B}${f.label}${C.x}`);
    console.log(`    ${C.d}at${C.x}      ${f.at}`);
    if (f.cmd) console.log(`    ${C.d}verify${C.x}  ${f.cmd}`);
    console.log(`    ${C.d}result${C.x}  ${f.why}`);
    if (f.output) {
      const trimmed = f.output.split('\n').slice(0, 6).join('\n              ');
      console.log(`    ${C.d}output${C.x}  ${trimmed}`);
    }
    console.log('');
  }
}

/**
 * Read-routing. Agents run this command while deciding what to open next, so it is the
 * cheapest place to say "read only this". Keeps sessions off the whole spec directory.
 */
function printRouting() {
  const next = nextUnticked;
  console.log(`${C.B}Read only what you need${C.x}  ${C.d}(specs/RULES.md)${C.x}`);
  if (next) {
    console.log(`  next task    ${C.b}${next.file}${C.x}${C.d}:${next.line}${C.x}  ${next.label}`);
    const dir = next.file.replace(/\/tasks\.md$/, '');
    console.log(`  endpoints    ${C.d}${dir}/API_CONTRACT.md${C.x}`);
    console.log(`  schema       ${C.d}${dir}/DATA_CONTRACT.md${C.x}`);
  }
  console.log(`  writing code ${C.d}specs/rules/06-standards.md${C.x}`);
  console.log(`  a VERIFY:    ${C.d}specs/rules/02-proof.md${C.x}`);
  console.log(`  Prisma model ${C.d}grep prisma/schema.prisma — never Read it whole (~22K tokens)${C.x}\n`);
}

const bits = [
  `${C.g}${tally.pass} passed${C.x}`,
  tally.fail ? `${C.r}${tally.fail} failed${C.x}` : null,
  tally.missing ? `${C.y}${tally.missing} ticked without VERIFY${C.x}` : null,
  `${C.d}${tally.unticked} not yet ticked${C.x}`,
  OPT.all && tally.probePass ? `${C.y}${tally.probePass} ready to tick${C.x}` : null,
].filter(Boolean);

console.log(`${C.B}Summary${C.x}  ${bits.join('  ·  ')}\n`);
printRouting();

if (tally.fail > 0 || (OPT.strict && tally.missing > 0)) {
  console.log(`${C.r}${C.B}FAILED${C.x} — a ticked task asserts something that is not true.\n`);
  process.exit(1);
}
if (tally.missing > 0) {
  console.log(`${C.y}Passed, but ${tally.missing} ticked task(s) carry no VERIFY line — run with --strict to enforce.${C.x}\n`);
}
console.log(`${C.g}${C.B}OK${C.x} — every ticked assertion holds.\n`);

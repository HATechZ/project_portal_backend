#!/usr/bin/env node
/**
 * db-prompt-guard — advisory routing nudge for database-shaped prompts.
 *
 * Wired as a Claude Code UserPromptSubmit hook in .claude/settings.json. When a
 * prompt mentions schema / database / migration / Prisma work, it prints a short
 * non-blocking notice that is injected into the model's context, pointing at the
 * `database-architect` subagent (which Article IX — specs/rules/08-database.md —
 * exempts for dev-time DBML + `prisma migrate dev` work).
 *
 * It NEVER exits non-zero: it cannot block a turn. A prompt with no database
 * keyword produces no output at all.
 *
 *   echo '{"prompt":"reshape the prisma schema"}' | node scripts/db-prompt-guard.mjs
 *   node scripts/db-prompt-guard.mjs "reshape the prisma schema"   # bare-arg form, for tests
 *
 * Exit 0 always.
 */

const KEYWORDS =
  /\b(schemas?|databases?|db|migrations?|migrate|prisma|dbml|erd|ddl|data ?models?|foreign ?keys?|indexe?s?|shard(?:ing)?|partition(?:ing)?|normaliz\w*|denormaliz\w*|entity[- ]relationship|table ?design)\b/i;

const NOTICE =
  '[db-prompt-guard] This prompt looks database-related. Route schema / data-model ' +
  'design and reshape work through the `database-architect` subagent — Article IX ' +
  '(specs/rules/08-database.md) exempts it for dev-time DBML edits, ' +
  '`node scripts/dbml-to-prisma.cjs`, and `prisma migrate dev`. Outside that subagent, ' +
  'do not hand-edit `prisma/schema.prisma` or the DBML, and never run ' +
  '`prisma migrate deploy`.';

async function readStdin() {
  if (process.stdin.isTTY) return '';
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  return raw;
}

async function main() {
  const argText = process.argv.slice(2).join(' ').trim();

  let prompt = argText;
  if (!prompt) {
    const raw = await readStdin();
    if (raw) {
      try {
        prompt = String(JSON.parse(raw)?.prompt ?? '');
      } catch {
        prompt = raw; // not JSON — treat the whole payload as the text
      }
    }
  }

  if (prompt && KEYWORDS.test(prompt)) process.stdout.write(NOTICE + '\n');
  process.exit(0);
}

main();

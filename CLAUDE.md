# Project Portal Backend — Agent Entry Point

**Project Portal** (`project-portal-backend`) — NestJS 11 + Prisma 7 + PostgreSQL (Neon) API
for a project/bid workflow management portal. Redis for cache, rate limiting, and the BullMQ
mail queue.

---

## Read this first

> **Rules:** [`specs/RULES.md`](specs/RULES.md) — the card. Read it once per session.
> **Status:** [`specs/INDEX.md`](specs/INDEX.md).
>
> This file is an entry point, not a rulebook. It does not restate rules and is not where you
> record progress. If those two files disagree with this one, they win.

The card carries the five gates, the ten non-negotiables, and a routing table naming the
single file to open for the task at hand. Full articles live in `specs/rules/` and are read on
demand — never all of them.

**Do not `Read` `prisma/schema.prisma` whole (~22K tokens). `grep` it.**

## Commands

```bash
docker compose up -d   # local Redis on 127.0.0.1:6379
yarn start:dev         # prestart: prisma generate only — never migrates
yarn lint              # eslint --fix — must be 0 errors
yarn build             # nest build — gated by the SDD lint; must be 0 errors
```

```bash
yarn verify:spec              # Gates 1-3: are the spec artifacts executable?
yarn verify:sdd               # Gate 5: do the ticked assertions hold? Ends with a read-routing hint.
yarn verify:sdd --module 03   # one module
yarn verify:sdd:strict        # also fail on ticked tasks with no VERIFY: line
```

---

## Claude-specific routing

> **The Gate 5 hook is active for you.** `.claude/settings.json` runs
> `node scripts/verify-sdd.mjs --hook` after every `Write`/`Edit`. Tick a task in a
> `tasks.md` without a `VERIFY:` line and the edit is blocked (exit 2) until you add one.
> A second hook, `node scripts/db-prompt-guard.mjs` on `UserPromptSubmit`, injects a
> **non-blocking** nudge toward the `database-architect` subagent on database-shaped prompts.

Rules tagged `[CLAUDE]` in the card apply to you in full:

| Rule | Your tooling |
|---|---|
| [Art. IV](specs/rules/04-vault.md) — vault sync | `om` MCP tools (`record_work`, `remember`). **Skip entirely if the server is not connected** — do not hand-write vault files. |
| [Art. V](specs/rules/05-walkthrough.md) — Gate 5 walkthrough | Browser tools against `/api/docs`, or `curl` via Bash. Record PASS/FAIL in `walkthrough.md`. |
| [Art. VI.10](specs/rules/06-standards.md) — library API verification | Context7 MCP: `resolve-library-id` → `query-docs`. Mandatory before writing against NestJS 11 / Prisma 7 / BullMQ. |
| [Art. IX](specs/rules/08-database.md) — schema design / reshape | The `database-architect` subagent (Task tool). Art. IX exempts it for dev-time DBML edits + `node scripts/dbml-to-prisma.cjs` + `prisma migrate dev`. Never let it run `prisma migrate deploy`. |

**Project subagent:** `database-architect` (`.claude/agents/database-architect.md`) —
schema design and reshape, per [Art. IX](specs/rules/08-database.md). It auto-delegates on
database / schema / migration prompts, and the `UserPromptSubmit` hook nudges you toward it.
No project skills beyond the two under `.claude/skills/`.

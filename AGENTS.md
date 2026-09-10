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

**Do not read `prisma/schema.prisma` whole (~22K tokens). `grep` it.**

## Token Efficiency and Verification Policy

Correctness comes first; optimize tokens by eliminating duplicate or irrelevant work, never by
weakening required checks. Reuse current-session and project context, approved specs, and recent
successful verification when relevant files/config have not changed. For spec-governed tasks,
start from the approved spec and directly relevant implementation files; do not re-read historical
ERD/docs/frontend/history unless the spec is ambiguous, conflicting, stale, or implementation
evidence requires reconciliation.

Read only files directly relevant to the task or changed since the last relevant audit. Avoid broad
repo scans, repeated architecture/source analysis, unrelated refactors, cleanup, documentation
changes, and multiple equivalent tests/diagnostics/catalog queries/lint/build/spec checks without a
concrete correctness reason. Use current repository conventions instead of researching alternatives
unnecessarily. Spawn reviewer/verifier/sub-agents only when repository SDD rules require them or
the user asks.

Prefer focused tests/checks first; run broader verification only when required by the applicable
spec or Definition of Done. Perform DB/catalog diagnostics only for concrete runtime/database
issues. Avoid model-based checks the user can reliably perform manually. When manual/local
verification is sufficient, output exactly:

```text
MANUAL CHECK
Command: <exact command>
Expected: <specific result to confirm>
```

Then wait for the result if that verification is required before proceeding. Keep progress updates
and final reports concise, report exact blockers/owner decisions when requirements are genuinely
ambiguous, and preserve unrelated working-tree changes.

**Safety exception:** token optimization must never skip correctness-critical checks required by
the applicable spec/SDD/Definition of Done, especially security/authentication/authorization,
tenant isolation/RLS/object-scope, migration/schema integrity, required focused tests, required
SDD/spec verification, or diagnostics necessary to resolve an actual failure.

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

## Codex-specific notes

> **How the gate reaches you.** `yarn build` runs the SDD lint first and fails if a task is
> ticked without a `VERIFY:` line. That is your enforcement point, in any tool. Claude Code
> additionally has a `PostToolUse` hook (`.claude/settings.json`) that blocks at tick time
> rather than build time; that file is Claude-specific and you can ignore it. Nothing about
> the rule is Claude-only — only the earlier feedback is.

Codex has one project subagent — `database-architect` (`.codex/agents/database-architect.toml`),
referenced by name for schema design / reshape (Art. IX). No skills. Rules tagged `[CLAUDE]`
do not apply to you — follow the `[ALL]` equivalent stated alongside each one:

| Rule | Your equivalent |
|---|---|
| [Art. IV](specs/rules/04-vault.md) — `om` MCP vault sync | If the server is not connected, **skip vault sync entirely**. Do not hand-write vault files — that creates a second, diverging log. Record the decision in the module's `SPEC.md`. |
| [Art. V](specs/rules/05-walkthrough.md) — Gate 5 walkthrough | Start the server and exercise each endpoint with `curl`. Record method, path, status, envelope shape, and `x-request-id` as PASS/FAIL in `walkthrough.md`. |
| [Art. VI.10](specs/rules/06-standards.md) — Context7 MCP | Read the installed package's types under `node_modules` and the version in `package.json`. Never rely on recall — Prisma 7's driver-adapter setup differs from every Prisma 5 tutorial. |
| [Art. IX](specs/rules/08-database.md) — schema design / reshape | Spawn the `database-architect` agent by name. It is the one path exempt from the Art. IX file/migrate lock (dev-time DBML + `dbml-to-prisma.cjs` + `prisma migrate dev` only). The `.claude/settings.json` prompt hook is Claude-only; you rely on naming the agent plus this row. |

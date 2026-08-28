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

Codex has no skills or subagents. Rules tagged `[CLAUDE]` do not apply to you — follow the
`[ALL]` equivalent stated alongside each one:

| Rule | Your equivalent |
|---|---|
| [Art. IV](specs/rules/04-vault.md) — `om` MCP vault sync | If the server is not connected, **skip vault sync entirely**. Do not hand-write vault files — that creates a second, diverging log. Record the decision in the module's `SPEC.md`. |
| [Art. V](specs/rules/05-walkthrough.md) — Gate 5 walkthrough | Start the server and exercise each endpoint with `curl`. Record method, path, status, envelope shape, and `x-request-id` as PASS/FAIL in `walkthrough.md`. |
| [Art. VI.10](specs/rules/06-standards.md) — Context7 MCP | Read the installed package's types under `node_modules` and the version in `package.json`. Never rely on recall — Prisma 7's driver-adapter setup differs from every Prisma 5 tutorial. |

# Rules — the card

**This is the only rules file you must read every session.** Everything else is fetched on
demand from the table below. Status lives in [`INDEX.md`](INDEX.md), never here.

## The five gates

Specs are the source of truth; code is downstream. The implementation surface is the NestJS
feature module: every `*.module.ts` must be registered in [`PLACEHOLDERS.md`](PLACEHOLDERS.md).

```
1  SPEC.md + DATA_CONTRACT.md / API_CONTRACT.md
2  plan.md
3  tasks.md — every leaf task carries a VERIFY: line
4  implement — one task at a time, lint + build clean
5  verify — every VERIFY: passes, walkthrough.md written
```

**A task is ticked on a command that exits 0, never on intent.** The agent that implements a
task does not verify it. Assertions are static — `grep`, `test`, `yarn lint`, `yarn build`.
Never write one needing a database, Redis, or the network.

## The eleven non-negotiables

1. No code under `src/` for a module with no `SPEC.md`.
2. **Never run a database-mutating command** (`prisma migrate*`, `db push`, `db seed`,
   `studio`, `yarn db:setup`) and **never edit** the DBML, `prisma/schema.prisma`, or
   `prisma/migrations/`. Propose schema changes in `DATA_CONTRACT.md` and stop.
   `prisma generate` is allowed — it never contacts the database.
   → [`rules/08-database.md`](rules/08-database.md)
3. Import Prisma from `src/generated/prisma`, never `@prisma/client`.
4. Never build the response envelope in a controller.
5. Never catch Prisma errors in a service — `mapPrismaException` does it.
6. `process.env` only in `src/config/configuration.ts`.
7. Work request and project status are derived from the latest event row, never stored.
8. **The layering law**: `controller → service → repository → this.db`. Each layer depends
   only on the next; none skips or reaches back. Controllers run no queries; services outside
   `src/infra/` name no concrete infrastructure. → [`rules/09-solid.md`](rules/09-solid.md)
9. Role grants are revoked by timestamp, never deleted.
10. Record progress in `INDEX.md` and nowhere else.
11. **Feature modules never import each other** — they publish events. Publish through the
    outbox inside the producer's transaction, never to the transport directly; a broker write
    in a transaction is a dual write. → [`rules/10-messaging.md`](rules/10-messaging.md)

## Read only what you need

| You are about to… | Read only… |
|---|---|
| Implement a ticked task | that module's `tasks.md` |
| Add or change an endpoint | that module's `API_CONTRACT.md` |
| Touch the schema or a query | that module's `DATA_CONTRACT.md` |
| Run any Prisma command | [`rules/08-database.md`](rules/08-database.md) **first** |
| Write a `VERIFY:` line | [`rules/02-proof.md`](rules/02-proof.md) |
| Write code in `src/` | [`rules/06-standards.md`](rules/06-standards.md) |
| Add a class, or refactor one | [`rules/09-solid.md`](rules/09-solid.md) — layering law + assertion catalogue |
| Publish an event, or write a consumer | [`rules/10-messaging.md`](rules/10-messaging.md) |
| Import across feature modules | [`rules/10-messaging.md`](rules/10-messaging.md) — don't; publish instead |
| Start or finish a module | [`rules/01-lifecycle.md`](rules/01-lifecycle.md) + `.specify/templates/` |
| Draft a Gate 1 contract | [`rules/03-contracts.md`](rules/03-contracts.md) |
| Run the Gate 5 walkthrough | [`rules/05-walkthrough.md`](rules/05-walkthrough.md) |
| Sync the Obsidian vault | [`rules/04-vault.md`](rules/04-vault.md) |
| Update status | [`rules/07-status.md`](rules/07-status.md) |
| Look up a Prisma model | **`grep` `prisma/schema.prisma` — never `Read` it whole (~22K tokens)** |

Rules are tagged `[ALL]` (binding on every agent) or `[CLAUDE]` (needs Claude tooling — the
`[ALL]` equivalent is stated alongside each one). A rule that only exists as a Claude
capability is not binding on Codex or Antigravity.

## Commands

```bash
yarn verify:spec              # Gates 1-3: are the spec artifacts executable?
yarn verify:sdd               # Gate 5: do the ticked assertions hold?
yarn verify:sdd --module 03   # one module
yarn verify:sdd:strict        # also fail on ticked tasks with no VERIFY: line
```

`yarn build` runs the SDD lint first and fails if any task is ticked without a `VERIFY:` line.
That gate binds every agent. Claude Code additionally blocks at tick time via a `PostToolUse`
hook — same rule, earlier feedback.

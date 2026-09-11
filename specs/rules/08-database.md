# Article IX - Database Boundary `[ALL]`

Read before any Prisma CLI command or schema work. Card: [`../RULES.md`](../RULES.md).

**Agents do not change the database.** The maintained schema authority is
`prisma/schema.prisma`; schema evolution is recorded in `prisma/migrations/**`; PostgreSQL is
the runtime database. Existing Prisma seed files remain authoritative for seed data.

`project_portal_workflow_management_erd.dbml` is an optional architectural Reference ERD when
available/provided. It may help explain the overall system and relationships, but it is not a
schema authority and may lag behind approved implementation changes. Missing or stale DBML
must never block Prisma schema, migration, seed, build, or deployment work, and
`scripts/dbml-to-prisma.cjs` is not part of the required workflow.

## Commands

| Allowed `[ALL]` | Why it is safe |
|---|---|
| `prisma generate` / `yarn prisma:generate` | Reads `schema.prisma`, writes `src/generated/prisma`. **Never contacts the database.** Required for `yarn build` and `yarn lint` to run. |
| `yarn build` / `yarn lint` / `yarn start` / `yarn start:dev` | Their `prestart` hooks generate only; the migrate step was removed precisely so these are safe. |

| Forbidden - owner only | Effect |
|---|---|
| `prisma migrate dev` / `yarn prisma:migrate` | Writes a migration **and applies it**; can reset the database |
| `prisma migrate deploy` / `yarn prisma:deploy` | Applies pending migrations to the live database |
| `prisma migrate reset` | Drops and recreates |
| `prisma db push` / `db seed` / `db execute` | Direct schema or data mutation |
| `prisma studio` | Interactive read/write GUI |
| `yarn db:setup` | Wraps `migrate deploy` |

If you believe one of these must run, **say so and stop.** Name the exact command and why.
Do not run it, and do not work around it with a raw `psql`, a script, or a Prisma call from
application code.

## Files agents edit only on sanctioned schema work

| Path | Guarded because |
|---|---|
| `prisma/schema.prisma` | It is the maintained schema authority |
| `prisma/migrations/**` | Applied history must match the reviewed migration plan and database state |
| `prisma/seed/**` | Seed data is authoritative data setup and can change access/security posture |

Outside explicitly approved schema/seed work, propose changes in the owning
`DATA_CONTRACT.md` and stop. During approved schema work, edit `prisma/schema.prisma`
directly, prepare the matching migration files, and report exact DB commands for the owner to
run. Do not restore, require, or regenerate from DBML.

`scripts/dbml-to-prisma.cjs` is retained only as a deprecated legacy converter for reference
DBML snapshots. It must not be used as a source-of-truth workflow, and Prisma schema must not
be regenerated from DBML.

## The database-architect subagent

Schema design, data-model changes, technology selection, and reshape work are delegated to
the `database-architect` subagent (installed for Claude at `.claude/agents/`, Gemini at
`.gemini/agents/`, Codex at `.codex/agents/`).

It is the primary exception to this article. When invoked for schema work it may:

- edit `prisma/schema.prisma`,
- prepare migration files under `prisma/migrations/**`,
- run `prisma migrate dev` against a **development** database when the owner has approved
  dev-database mutation for that task.

It still must **not** run `prisma migrate deploy`, `prisma migrate reset`, `prisma db push`,
`db seed`, or `db execute` against a shared or production database, and it must report
exactly which tables, columns, and migrations it changed so the owner can review before
deploying.

Every other agent, and Claude / Codex / Antigravity acting **outside** this subagent, remains
fully bound by the prohibitions above. On Claude, a `UserPromptSubmit` hook
(`scripts/db-prompt-guard.mjs`) posts a non-blocking reminder to route database-shaped
prompts here.

## When a schema change is needed

If the owner has not explicitly approved schema work, propose it; do not perform it.

1. Write the proposal into the owning module's `DATA_CONTRACT.md`, under a
   `## Proposed schema change` heading. State the tables and columns, the type and
   nullability of each, the relations, and what breaks without it.
2. Add a row to the **Open deviations** table in [`../INDEX.md`](../INDEX.md) so it is visible
   without reading the module.
3. Stop. Tell the owner what you need and which command produces it, e.g.:

   ```text
   Needs: widgets.external_code uniqueness constraint.
   Proposed in specs/NN-example/DATA_CONTRACT.md - Proposed schema change.
   To apply - update prisma/schema.prisma, then:
     yarn prisma:migrate --name widget_external_code_unique
   ```

4. Do not tick any task that depends on the change until the owner confirms it is applied.
   A `VERIFY:` line asserting a column exists will fail until then; that is correct.

## Deployment note

`prestart`, `prestart:dev`, and `prestart:prod` run `prisma generate` **only**. They no longer
run `prisma migrate deploy`. Production deploys therefore need migration as an **explicit
step** (`yarn prisma:deploy`) before the process starts; it is no longer automatic.

# Article IX — Database Boundary `[ALL]`

Read before any Prisma CLI command or schema work. Card: [`../RULES.md`](../RULES.md).

**Agents do not change the database, and do not change what defines it.** The owner runs
every migration and every schema regeneration by hand. This is not advisory — it is the one
rule in this repo whose violation cannot be undone by editing a file.

## Commands

| Allowed `[ALL]` | Why it is safe |
|---|---|
| `prisma generate` · `yarn prisma:generate` | Reads `schema.prisma`, writes `src/generated/prisma`. **Never contacts the database.** Required for `yarn build` and `yarn lint` to run. |
| `yarn build` · `yarn lint` · `yarn start` · `yarn start:dev` | Their `prestart` hooks generate only — the migrate step was removed precisely so these are safe. |

| Forbidden — owner only | Effect |
|---|---|
| `prisma migrate dev` · `yarn prisma:migrate` | Writes a migration **and applies it**; can reset the database |
| `prisma migrate deploy` · `yarn prisma:deploy` | Applies pending migrations to the live database |
| `prisma migrate reset` | Drops and recreates |
| `prisma db push` · `db seed` · `db execute` | Direct schema or data mutation |
| `prisma studio` | Interactive read/write GUI |
| `yarn db:setup` | Wraps `migrate deploy` |

If you believe one of these must run, **say so and stop.** Name the exact command and why.
Do not run it, and do not work around it with a raw `psql`, a script, or a Prisma call from
application code.

## Files agents do not edit

| Path | Owner-only because |
|---|---|
| `project_portal_workflow_management_erd.dbml` | It defines the schema; editing it starts a migration |
| `prisma/schema.prisma` | Generated output; regenerating it is an owner step |
| `prisma/migrations/**` | Applied history — a hand-edited migration diverges from the database |
| `scripts/dbml-to-prisma.cjs` | Changing the generator changes the schema it emits |

## When a schema change is needed

Propose it; do not perform it.

1. Write the proposal into the owning module's `DATA_CONTRACT.md`, under a
   `## Proposed schema change` heading. State the tables and columns, the type and
   nullability of each, the relations, and what breaks without it.
2. Add a row to the **Open deviations** table in [`../INDEX.md`](../INDEX.md) so it is visible
   without reading the module.
3. Stop. Tell the owner what you need and which command produces it, e.g.:

   ```
   Needs: users.email case-insensitive unique index.
   Proposed in specs/03-identity-and-access/DATA_CONTRACT.md § Proposed schema change.
   To apply — edit the DBML, then:
     node scripts/dbml-to-prisma.cjs
     yarn prisma:migrate --name ci_unique_email
   ```

4. Do not tick any task that depends on the change until the owner confirms it is applied.
   A `VERIFY:` line asserting a column exists will fail until then — that is correct.

## Deployment note

`prestart`, `prestart:dev`, and `prestart:prod` run `prisma generate` **only**. They no longer
run `prisma migrate deploy`. Production deploys therefore need migration as an **explicit
step** (`yarn prisma:deploy`) before the process starts — it is no longer automatic.

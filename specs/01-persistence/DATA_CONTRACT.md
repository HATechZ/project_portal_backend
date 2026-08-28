# Data Contract: 01 — Persistence

This module owns no tables. It owns the pipeline that produces them, and the conventions
every other `DATA_CONTRACT.md` inherits.

---

## 1. The generation pipeline

```
project_portal_workflow_management_erd.dbml     ← the authority.        OWNER ONLY
        │
        │  node scripts/dbml-to-prisma.cjs      ← overwrites the schema  OWNER ONLY
        ▼
prisma/schema.prisma                            ← generated.            OWNER ONLY
        │
        │  prisma generate                      ← postinstall + prestart. agents may run
        ▼
src/generated/prisma/                           ← gitignored; import from here
        │
        │  prisma migrate dev --name <name>     ← after a schema change  OWNER ONLY
        ▼
prisma/migrations/                                                      OWNER ONLY
```

Only `prisma generate` is open to agents — it reads the schema and writes the client, and
never contacts the database. Everything else in this pipeline is owner-run
([Art. IX](../rules/08-database.md)).

Current state: **63 tables, 20 enums**, one migration (`20260812000000_init`).

### Naming rules the script applies

| DBML | Prisma | Note |
|---|---|---|
| `work_requests` | `model WorkRequest` | singularized, PascalCase |
| `project_statuses` | `model ProjectStatus` | `-statuses` → `-status` |
| `companies` | `model Company` | `-ies` handled explicitly |
| `created_at` | `createdAt @map("created_at")` | camelCase + `@map` |
| `Enum actor_role_code` | `enum ActorRoleCode @@map(...)` | |
| FK `projects.client_id` | forward: `client Client` | `_id` stripped |
| | inverse: `projectsByClientId Project[]` | `<table>By<FkField>` — verbose by construction |

The inverse-relation names are mechanical, not chosen. Do not rename them in the schema;
rename them in the generator if they must change.

---

## 2. Type mapping

| DBML | Prisma | Native |
|---|---|---|
| `uuid` | `String` | `@db.Uuid` |
| `varchar(n)` | `String` | `@db.VarChar(n)` |
| `text` | `String` | `@db.Text` |
| `timestamp` | `DateTime` | `@db.Timestamp(6)` |
| `date` | `DateTime` | `@db.Date` |
| `boolean` / `int` / `bigint` | `Boolean` / `Int` / `BigInt` | — |
| `jsonb` | `Json` | `@db.JsonB` |
| `decimal(p,s)` | `Decimal` | `@db.Decimal(p, s)` |

An unsupported DBML type throws at generation time rather than emitting something wrong.

---

## 3. Connection

Prisma 7 with the **driver adapter** `@prisma/adapter-pg`. The `datasource` block declares
no `url`:

| Context | Source of `DATABASE_URL` |
|---|---|
| CLI (`migrate`, `studio`) | `prisma.config.ts` → `env('DATABASE_URL')` via `dotenv/config` |
| Runtime | `PrismaService` → `ConfigService.get('database.url')` → `new PrismaPg(...)` |

Consequence: a tutorial that says to put `url = env("DATABASE_URL")` in the schema is written
for Prisma 5 and will not apply here.

---

## 4. Conventions every table follows

- **Primary key** — `id String @id @db.Uuid`, supplied by the application via `randomUUID()`.
  There is no DB-side default; an insert without an explicit id fails.
- **Timestamps** — `createdAt` / `updatedAt` as `@db.Timestamp(6)` with `@default(now())`.
  `updatedAt` has no `@updatedAt` directive; services set it.
- **Soft delete** — where a table has `deletedAt`, reads must filter it. Only `documents` and
  `document_versions` carry one today.
- **Derived state** — `work_requests` and `projects` deliberately have **no status column**.
  See Constitution Art. VI.2.

---

## 5. Transactions

`UnitOfWorkService.execute(work, options)`:

| Option | Default |
|---|---|
| `maxWait` | 5 000 ms |
| `timeout` | 15 000 ms |
| `isolationLevel` | Postgres default (read committed) |

Re-entrancy: if a transaction is already in the AsyncLocalStorage store, `execute` runs the
callback against it and does **not** open a second one. This is what makes
`service → repository → repository` composition safe.

`BaseRepository.db` returns the ambient transaction client when one is open, otherwise
`PrismaService`. A repository therefore never knows whether it is in a transaction, which is
the point.

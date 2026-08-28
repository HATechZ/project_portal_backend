# Technical Plan: 01 — Persistence

**Status:** Approved (retro-spec)
**Related Spec:** `specs/01-persistence/SPEC.md`
**Contracts:** `DATA_CONTRACT.md`

---

## 1. Module Tree

```
prisma/
├── schema.prisma                 # GENERATED — do not edit
└── migrations/20260812000000_init/migration.sql
prisma.config.ts                  # CLI datasource + migrations path
scripts/dbml-to-prisma.cjs        # DBML → schema.prisma
src/infra/prisma/
├── prisma.module.ts              # @Global — feature modules do not import it
├── prisma.service.ts             # PrismaClient + PrismaPg adapter, connect/disconnect
├── unit-of-work.service.ts       # AsyncLocalStorage transaction store
├── base.repository.ts            # this.db + this.transaction
└── prisma-executor.type.ts       # PrismaClient | TransactionClient
```

`PrismaModule` is `@Global()`. This is why `UsersModule` has an empty `imports` array — and
why a future feature module should also not import it.

---

## 2. Executor resolution

```
Repository.db
     │
     └─► UnitOfWorkService.client
              │
              ├─ AsyncLocalStorage has a transaction?  ──► that transaction client
              └─ otherwise                             ──► PrismaService
```

`PrismaExecutor = PrismaClient | PrismaTransactionClient`. The transaction client type is
derived from `PrismaClient['$transaction']` rather than named directly, so it survives Prisma
version bumps that rename the interactive-transaction type.

Note the narrowing: a transaction client has no `$transaction`, `$connect`, or `$on`. Code
written against `this.db` must stay inside the query surface both types share.

---

## 3. Transaction composition

```typescript
// service
await this.unitOfWork.execute(async () => {
  await this.projects.create(...);        // joins
  await this.auditLogs.append(...);       // joins the same one
});
```

`BaseRepository.transaction(work)` delegates to the same `execute`, so a repository that
opens a transaction for its own multi-step write composes correctly when a service has
already opened one.

**Anti-pattern:** calling `prisma.$transaction` directly. It bypasses the store, so
repositories called inside it silently use the non-transactional client and their writes are
not rolled back with the rest.

---

## 4. Startup / shutdown

| Hook | Action |
|---|---|
| `prestart` / `prestart:dev` / `prestart:prod` | `prisma generate` — **no migrate** |
| `PrismaService.onModuleInit` | `$connect()` |
| `PrismaService.onModuleDestroy` | `$disconnect()` |

Shutdown only runs because module 00 calls `enableShutdownHooks()`.

Migration was deliberately removed from every start path so that running the app cannot mutate
the database ([Art. IX](../rules/08-database.md)). **Production deploys must run
`yarn prisma:deploy` as an explicit step** before starting the process.

---

## 5. Changing the schema — owner only

Agents do not perform this sequence. It is recorded so the proposal an agent writes into
`DATA_CONTRACT.md` names the right commands:

```bash
$EDITOR project_portal_workflow_management_erd.dbml
node scripts/dbml-to-prisma.cjs          # regenerates schema.prisma wholesale
yarn prisma:migrate --name <name>        # migrate dev
yarn build                               # typecheck against the new client
```

The generator prints `Generated N models, M enums, and R relations.` A drop in N after an edit
means a `Table` block stopped parsing — the regex requires the closing `}` at column 0.

An agent that needs a schema change writes a `## Proposed schema change` section in the
module's `DATA_CONTRACT.md`, adds a row to `INDEX.md`, and stops.

---

## 6. Errors

| Case | Thrown | Mapped to |
|---|---|---|
| P2002 unique | `PrismaClientKnownRequestError` | 409 `CONFLICT` (module 00) |
| P2003 FK | `PrismaClientKnownRequestError` | 409 `DATABASE_CONSTRAINT` |
| P2025 missing | `PrismaClientKnownRequestError` | 404 `NOT_FOUND` |
| Init failure | `PrismaClientInitializationError` | 503 `SERVICE_UNAVAILABLE` |

Repositories and services let all four propagate untouched.

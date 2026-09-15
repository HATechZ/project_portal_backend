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
├── prisma.service.ts             # separate app_user/scoped and app_relay/unscoped clients
├── unit-of-work.service.ts       # AsyncLocalStorage transaction store
├── base.repository.ts            # this.db + this.transaction
└── prisma-executor.type.ts       # TenantPrismaClient | TransactionClient
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
              └─ otherwise                             ──► throw (fail closed)
```

`PrismaExecutor = TenantPrismaClient | PrismaTransactionClient`. The transaction client type is
derived from the scoped client's `$transaction` callback rather than named directly, so it
survives Prisma version bumps that rename the interactive-transaction type.

Note the narrowing: a transaction client has no `$transaction`, `$connect`, or `$on`. Code
written against `this.db` must stay inside the query surface both types share.

---

## 3. Transaction composition

A root `UnitOfWorkService.execute` obtains the tenant from `RequestContext`, opens
`PrismaService.scoped.$transaction` on the normal `DATABASE_URL` / `app_user` client, and awaits
a parameter-bound `set_config('app.tenant_id', tenantId, true)` before placing the transaction in
AsyncLocalStorage or running repository work. The setting is transaction-local. Repository
executor access without that active unit of work throws.

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
repositories called inside it open or join their own UnitOfWork transaction rather than the
caller-created transaction. Their writes are therefore not rolled back with the caller's work.

The separate `DATABASE_URL_PRIVILEGED` / `app_relay` client is exposed only as
`PrismaService.unscoped` for approved cross-tenant relay operations. It is not a repository
executor and never participates in the normal UnitOfWork path.

---

## 4. Startup / shutdown

| Hook | Action |
|---|---|
| `prestart` / `prestart:dev` / `prestart:prod` | `prisma generate` — **no migrate** |
| `PrismaService.onModuleInit` | Connect the normal app client and separate privileged relay client |
| `PrismaService.onModuleDestroy` | Disconnect both runtime clients |

Shutdown only runs because module 00 calls `enableShutdownHooks()`.

Migration was deliberately removed from every start path so that running the app cannot mutate
the database ([Art. IX](../rules/08-database.md)). **Production deploys must run
`yarn prisma:deploy` as an explicit step** before starting the process. Supply the
provider/table-owner credential only to that administrative migration session as
`DATABASE_URL`; do not retain it as a NestJS serving-runtime connection.

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

# Article VI — Engineering Standards `[ALL]`

Read before writing code in `src/`. Card: [`../RULES.md`](../RULES.md).

## 1. The DBML is the schema source

`prisma/schema.prisma` is **output**, produced by `node scripts/dbml-to-prisma.cjs` from
`project_portal_workflow_management_erd.dbml`. The script overwrites the entire file.

**Agents do not perform schema changes.** The DBML, the generated schema, and
`prisma/migrations/` are owner-only, and every migration command is forbidden. Propose the
change in the module's `DATA_CONTRACT.md` and stop — see
[`08-database.md`](08-database.md), which governs this in full.

Reading the schema is fine: `grep` it, never `Read` it whole (~22K tokens).

The generated client is emitted to `src/generated/prisma` and is gitignored. Import from
`'../generated/prisma/client'`, never `@prisma/client`.

## 2. Current state is derived, never stored

A work request's status is the `to_status_id` of its latest `work_request_audit_logs` row. A
project's status is the `to_status_id` of its latest `project_status_events` row.

Never add a `status` column to `work_requests` or `projects`, and never cache the derived
value where it can diverge. Write status changes as events; read them as "latest event".

## 3. One response envelope, applied centrally

Success is wrapped by `ResponseInterceptor` as `{ success: true, data, meta }`. Errors are
shaped by the global `HttpExceptionFilter` as `{ success: false, error, meta }`.

- Controllers return plain data or entities. Never construct an envelope in a controller.
- Document the real shape with `wrapEnvelope(Model)` or `@ApiPaginatedResponse(Model)` — a
  bare `@ApiOkResponse({ type: X })` documents the wrong shape.

## 4. Errors are domain-coded and mapped once

Throw `AppException` with an `AppErrorCode`. Prisma errors are translated centrally by
`mapPrismaException`; **services must not catch `PrismaClientKnownRequestError` themselves.**
A new failure mode means a new `AppErrorCode`, not a bare `HttpException`.

## 5. Persistence goes through the unit of work

Repositories extend `BaseRepository` and read `this.db`, which resolves only to the active
ambient transaction. Repository access without an active unit of work fails closed; it never
falls back to the root `PrismaService`. A root `UnitOfWorkService.execute(...)` obtains the
tenant from `RequestContext`, opens a transaction on the normal `DATABASE_URL` / `app_user`
client, and safely sets transaction-local `app.tenant_id` before repository work. Nested units
of work and `this.transaction(...)` join the ambient transaction rather than nesting.

`PrismaService.unscoped` uses the separate `DATABASE_URL_PRIVILEGED` / `app_relay` connection
and is reserved for the approved cross-tenant relay path. It is not a normal repository
executor.

Services depend on repositories. Injecting `PrismaService` into a service is permitted only in
`src/infra/`. Calling `prisma.$transaction` directly bypasses the store — repositories inside
it silently use the non-transactional client and are not rolled back.

## 6. Configuration is typed and centralized

`process.env` is read **only** in `src/config/configuration.ts`. Elsewhere inject
`ConfigService<AppConfiguration, true>` and read dotted paths with `{ infer: true }`.

Adding a variable touches four files together: `src/config/env.ts`, `src/config/env.schema.ts`,
`src/config/configuration.ts`, `.env.example`.

## 7. Validation at the edge

Every body and query is a DTO class with `class-validator` decorators. The global pipe runs
`whitelist: true, forbidNonWhitelisted: true` with implicit conversion **off** — numeric query
params need an explicit `@Type(() => Number)`.

## 8. SOLID & DRY

Governed in full by [`09-solid.md`](09-solid.md), which is **strict**: SRP, ISP, and DIP are
machine-checked by assertions, OCP/LSP/DRY are binding at review. In short — a controller
routes, a service decides, a repository persists, and each layer depends only on the next.
Read that article before adding or refactoring any class.

## 9. Behavioral guidelines (Karpathy)

1. **Think before coding** — don't assume, don't hide confusion, surface tradeoffs.
2. **Simplicity first** — the minimum code that solves the problem; no speculative features.
3. **Surgical changes** — touch only what you must; preserve adjacent code and formatting.
4. **Goal-driven** — define verifiable success criteria *before* building. Here that is
   literal: write the `VERIFY:` line before the implementation.

## 10. Library API verification

Before writing against NestJS 11, Prisma 7, BullMQ, ioredis, or `class-validator`, verify
current API syntax and breaking changes. Prisma 7's driver-adapter setup and `prisma.config.ts`
differ from every tutorial written for Prisma 5.

- **Claude:** Context7 MCP (`resolve-library-id` → `query-docs`). `[CLAUDE]`
- **`[ALL]` equivalent:** read the installed package's types under `node_modules` and the
  version pinned in `package.json`. Never rely on training-data recall for API shape.

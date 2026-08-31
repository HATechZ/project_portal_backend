# Technical Plan: 01.1 — Schema Integrity & Tenant Isolation

**Status:** Draft (Gate 2)
**Related Spec:** `specs/01.1-schema-integrity/SPEC.md`
**Contracts:** `DATA_CONTRACT.md`

This module has almost no feature surface. It is nine migrations, four infrastructure edits,
and one new script. The plan is therefore about **ordering and reversibility**, not about
controllers and DTOs.

---

## 1. Preconditions

Two things must be settled before Phase 6. Neither is this module's to decide.

| # | Blocker | Who resolves | Why it blocks |
|---|---|---|---|
| P-1 | The DBML is deleted from the working tree and the `HEAD` copy is stale (module 01 deviation). Running `dbml-to-prisma.cjs` would drop `OutboxMessage` / `ProcessedEvent` and revert migration `20260821000000`. | Owner | Every phase from 7 on edits the schema. If the generator is the path, it must produce today's schema first. If `schema.prisma` is now the source of truth, Art. IX §"Files agents do not edit" needs amending to say so. |
| P-2 | Does `workflow_transitions.target_role_id` vary by status pair, or only by action? | Owner / module 09 | Decides whether Phase 9 splits routing into its own table or drops only `from_role_id`. |

**Phase 5 is not blocked by either.** It is pure application code and ships today — which is
why it is first.

---

## 2. Code surface

Only these files under `src/` change. Everything else is SQL.

```
scripts/
└── verify-tenant-scope.mjs        # NEW — parses schema.prisma, diffs against the constants
src/
├── common/tenant/
│   ├── tenant.constants.ts        # unchanged in content; now build-enforced
│   └── tenant-context.guard.ts    # Prisma lookup → cached read
├── config/
│   ├── env.schema.ts              # + DATABASE_URL_PRIVILEGED
│   ├── configuration.ts           # + database.privilegedUrl
│   └── env.ts                     # + the type
└── infra/prisma/
    ├── prisma.service.ts          # unscoped client connects privileged
    └── unit-of-work.service.ts    # SET LOCAL app.tenant_id as the first statement
```

`tenant-prisma.extension.ts` is deliberately untouched. It works, and layering RLS beneath it
is not a reason to rewrite it.

---

## 3. Where the tenant GUC is set

`UnitOfWorkService.execute` already wraps `$transaction` and already runs every write. It is
the only place that sees the start of a transaction, so it is the only correct place for
`SET LOCAL`:

```typescript
return this.prisma.scoped.$transaction(async (transaction) => {
  await transaction.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
  return this.storage.run(transaction, () => work(transaction));
}, { ... });
```

`set_config(..., true)` is `SET LOCAL` — scoped to the transaction, released on commit or
rollback, and safe under connection pooling. A literal `SET LOCAL` cannot take a bind
parameter; `set_config` can, which is the difference that matters here.

**Reads outside a transaction are the open edge.** `UnitOfWorkService.client` falls back to
`this.prisma.scoped` when no transaction is open, and that path sets no GUC — so under Phase 6
every non-transactional read returns zero rows. Two options, and the owner picks:

- **(a)** Route every read through `execute()`, making the unit of work universal.
- **(b)** Extend the Prisma client with a `$allOperations` hook that wraps non-transactional
  calls in an implicit transaction carrying the GUC.

(b) is less invasive and keeps repository code unchanged; (a) is simpler to reason about.
`tasks.md` asserts the GUC is set in `unit-of-work.service.ts` and stays neutral on which.

---

## 4. Migration ordering

Nine migrations. The order is not preference — each edge below is a hard dependency.

```
P5  parity script + guard cache        (no migration)
     │
P6  roles → RLS enable → policies      ← must be one migration; policies without
     │                                   the relay role break the outbox
     ├──────────────┬──────────────┐
P7  composite FK   P8  drop derived  P12 lookup collapse + hygiene
     │              │
     │              └── P8 drops members.company_id, which P10 also touches —
     │                  run P8 first so P10's backfill sees the final shape
     │
P9  workflow_transitions              (independent; gated on P-2)
     │
P10 people + user_accounts + backfill  ← touches every FK into users
     │
P11 actor_profiles kind + constraints  ← needs P10's person_id to exist
```

Three constraints worth stating plainly:

1. **Phase 6 is one migration.** Enabling RLS and creating the privileged role in separate
   migrations leaves a window where the relay reads nothing.
2. **Phase 12 must precede nothing.** Dropping `workspace_types` fails while `projects.workspace_type_id`
   still references it, so each collapse is `ALTER TABLE ... ADD COLUMN enum` → backfill →
   `DROP CONSTRAINT` → `DROP TABLE`, in that order, per table.
3. **Phase 11 after Phase 10.** The `CHECK` references `person_id`, which Phase 10 creates.

---

## 5. Rollback

| Phase | Reversible | Note |
|---|---|---|
| 5 | n/a | No schema change. |
| 6 | Yes | `DROP POLICY` + `ALTER TABLE ... DISABLE ROW LEVEL SECURITY`. Roles persist harmlessly. |
| 7 | Yes | Drop the composite FK, restore the single-column one. Data unaffected. |
| 8 | **No** | Dropped columns lose their values. Derivable by definition, so a down-migration can recompute them — write it. |
| 9 | Partly | `from_role_id` values are lost. Capture them into a scratch table in the up-migration if module 09 may still need them. |
| 10 | **No** | The identity split cannot be undone once `users` is gone. Mitigated by retaining `users_legacy` for one release (`DATA_CONTRACT.md` §4). |
| 11 | Yes | Drop the constraint, index, and enum column. |
| 12 | **No** | Dropped lookup tables lose their `description` text. Copy it into a comment or a seed file first. |

Nothing here runs `prisma migrate deploy`. Per Art. IX that is the owner's command and this
module never invokes it.

---

## 6. Errors

| Case | Surfaces as | Mapped to |
|---|---|---|
| Composite FK violated by a cross-tenant write | Prisma `P2003` | `mapPrismaException` → 409 `DATABASE_CONSTRAINT` |
| `actor_profiles_kind_target` violated | Prisma `P0001` / raw check violation | needs a `mapPrismaException` entry — **new**, see below |
| `actor_profiles_one_default` violated | Prisma `P2002` | already central; add the index name to the constraint→message map |
| Duplicate workflow transition | Prisma `P2002` | same map |
| RLS returns zero rows for a missing GUC | Not an error — an empty result | This is the failure mode to watch in the walkthrough, because it is silent to the ORM |

`mapPrismaException` currently keys P2002 on literal index names from `prisma/migrations/`
(module 00's work). Phases 9, 11 and 12 each add an index name, and Phase 11 adds the first
`CHECK` constraint the map has had to handle. That entry is application code, not schema, so it
is not blocked by P-1 and can land with Phase 5.

---

## 7. What this module does not do

No repository, service, controller, DTO, or entity is written here. Modules 03, 04, 05 and 09
consume the reshaped tables and own their surfaces. This module changes the ground they will
be built on — which is the entire argument for doing it before they exist.

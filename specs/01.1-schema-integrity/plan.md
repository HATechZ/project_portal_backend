# Technical Plan: 01.1 — Schema Integrity & Tenant Isolation

**Status:** Gate 3 · destructive Phases 8–12 decision-gated
**Related Spec:** `specs/01.1-schema-integrity/SPEC.md`
**Contracts:** `DATA_CONTRACT.md`

This module has almost no feature surface. It is nine migrations, four infrastructure edits,
and one new script. The plan is therefore about **ordering and reversibility**, not about
controllers and DTOs.

---

## 1. Preconditions

The two original preconditions were resolved by the owner on 2026-09-01.

| # | Blocker | Who resolves | Why it blocks |
|---|---|---|---|
| P-1 | Reconstruct the missing DBML against the legitimate current Prisma schema and migration history, preserving `OutboxMessage`, `ProcessedEvent`, and `20260821000000`. DBML remains authoritative. | `database-architect` | Resolved; reconstruction precedes schema reshaping. |
| P-2 | Keep nullable `target_role_id` on `workflow_transitions`; do not split action-global routing in 01.1. | Owner | Resolved; Phase 9 drops only `from_role_id` and adds transition uniqueness. |

Unrelated destructive Phase 8–12 redesigns are not implicitly approved by these decisions;
each continues through its own requirements and decision gate.

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

**Resolved read strategy (2026-09-01): universal repository units of work.** Every public
repository operation, including a single read, calls `UnitOfWorkService.execute`. Nested calls
join the ambient transaction. The unit of work runs parameterized `set_config` as its first
statement and only then exposes the transaction client through AsyncLocalStorage.

`UnitOfWorkService.client` no longer falls back to the root scoped client. Access without an
active unit of work throws before Prisma receives a query. This makes the GUC requirement
structural rather than dependent on each caller remembering to open a transaction. The
outbox and inbox repositories use the same helper, so they still join a producer/consumer
transaction when one exists.

---

## 4. Migration ordering

Nine migrations. The order is not preference — each edge below is a hard dependency.

```
P5  parity script + guard cache        (no migration)
     │
P6  pre-provisioned roles → grants + RLS policies  ← one migration; role credentials
     │                                               stay outside schema history
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

`document_version_folder_locations.folder_path` is not part of Phase 8 removal. It remains a
materialized logical-path cache, with synchronization/rebuild behavior owned by module 08.

Three constraints worth stating plainly:

1. **Phase 6 is one migration.** Runtime roles and credentials are pre-provisioned outside
   schema history. The migration atomically validates them, applies audited grants, enables
   RLS, and creates policies, so there is no applied state where the relay lacks access.
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
| RLS evaluates with a missing GUC | PostgreSQL error from `current_setting` | Intentional fail-closed behavior; the walkthrough must confirm the request fails rather than returning an empty success |

`mapPrismaException` currently keys P2002 on literal index names from `prisma/migrations/`
(module 00's work). Phases 9, 11 and 12 each add an index name, and Phase 11 adds the first
`CHECK` constraint the map has had to handle. That entry is application code, not schema, so it
is not blocked by P-1 and can land with Phase 5.

---

## 7. What this module does not do

No repository, service, controller, DTO, or entity is written here. Modules 03, 04, 05 and 09
consume the reshaped tables and own their surfaces. This module changes the ground they will
be built on — which is the entire argument for doing it before they exist.

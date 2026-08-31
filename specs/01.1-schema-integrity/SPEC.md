# SPEC: 01.1 — Schema Integrity & Tenant Isolation

**Status:** Draft (Gate 1) · **Tables:** — (owns none; reshapes 52)
**Contracts:** `DATA_CONTRACT.md` · **Law:** [Art. IX](../rules/08-database.md)

Tenant isolation currently rests on exactly one layer: a Prisma client extension written in
application code. It is well built — it fails closed, it covers all 52 scoped models, and the
auth guard cross-checks the JWT tenant claim against the header so `x-tenant-id` is not
blindly trusted. It is still one layer, and it has structural blind spots that no amount of
care inside it can close.

At the same time the schema carries a set of derived columns that let two rows contradict each
other, identity duplicated across three tables, and an untyped polymorphic union on the
highest-fan-in table in the model.

This module addresses both, because they are the same problem stated twice: **invariants that
live only in application code are invariants the database will happily let you violate.**

It is a sibling of module 01, not part of it. Module 01 is a retro-spec of the persistence
pipeline as shipped; this is a forward change to what that pipeline emits.

## Why now, and not after module 06

Modules 05–13 are Phase 0. Nine modules, 44 tables, zero repositories written. Every move
below is a migration today; after those modules exist each one is a migration *plus* a rewrite
of every repository, DTO, and entity that touched the old shape.

The identity split (Phase 10) is the sharpest case. It changes `Member` and `ClientContact`,
which modules 04 and 05 own and neither has been built. Doing it now costs one migration and
a backfill. Doing it after module 05 ships costs that plus a rewrite of module 05.

**This module must land before 06.** Its number places it there; its position in the index
does not.

## Five organizing decisions

1. **Layers, not a rewrite.** The Prisma extension stays exactly as it is. RLS goes underneath
   it and composite keys underneath that. Nothing here removes a working control; each move
   adds a floor beneath one.
2. **RLS first, composite keys second, and only where they earn it.** RLS is one migration and
   covers three of the four blind spots because it sits below every client rather than inside
   one. Composite foreign keys cost real ergonomics — wider indexes, noisier relation syntax,
   care on optional and self-referencing relations — so they go on the five chains where a
   cross-tenant row would be most damaging and hardest to notice, not on all 52.
3. **A privileged role, not a permissive policy.** The outbox relay must read across tenants.
   The tempting policy is `current_setting(...) IS NULL OR tenant_id = ...`, which makes "no
   tenant set" mean "see everything" — that turns every forgotten `SET LOCAL` into a silent
   full-table read. Instead the relay connects as a separate `BYPASSRLS` role and the app role
   gets no escape hatch at all.
4. **Shared-schema stays.** Nothing here moves toward schema-per-tenant or database-per-tenant.
   Schema-per-tenant would break the relay's cross-tenant drain and multiply every migration by
   tenant count; database-per-tenant is a contractual-isolation answer to a question nobody has
   asked yet.
5. **5NF is not the goal.** Every table has a single-column surrogate key, so by Date's theorem
   (3NF plus simple candidate keys implies 5NF) the schema already qualifies. Run the analysis
   on the natural keys instead and one relation — `workflow_transitions` — carries a genuine
   join dependency. That one is Phase 9. The rest of this module is 3NF and constraint work,
   and calling it 5NF work would be a category error.

## User stories

| | As a | I want | So that |
|---|---|---|---|
| US-01 | operator | a cross-tenant row to be impossible, not merely unwritten | isolation survives a bug in one code path |
| US-02 | developer adding a model | the scoped-model list to fail the build when I forget it | a new table cannot be silently unscoped |
| US-03 | developer | one home for a person's name and email | a rename cannot leave two records disagreeing |
| US-04 | developer reading `actor_profiles` | the row to say which kind of actor it is | consuming code stops guessing from null patterns |
| US-05 | workflow author | one row per action-and-source-status | the engine's next state is deterministic |
| US-06 | operator | tenant activation checked without a query per request | the isolation layer is not also a latency tax |
| US-07 | reviewer | every schema change proposed before it is applied | Art. IX holds through a reshape this wide |

## Domain rules

| # | Rule | Enforced by |
|---|---|---|
| DR-01 | A row's `tenant_id` equals the `tenant_id` of every row it references | composite FK (Phase 7) on the guarded chains; RLS elsewhere |
| DR-02 | A connection with no tenant GUC set reads nothing from a scoped table | RLS policy — no `IS NULL` escape |
| DR-03 | Only the relay's role may read across tenants | separate `BYPASSRLS` database role |
| DR-04 | `TENANT_SCOPED_MODELS` equals the set of models declaring `tenantId` | `scripts/verify-tenant-scope.mjs` in `prebuild` |
| DR-05 | A person's name and email exist in exactly one table | `Person`; `Member` and `ClientContact` carry neither |
| DR-06 | An `actor_profile` references exactly one of member or client contact, matching its kind | `CHECK actor_profiles_kind_target` |
| DR-07 | A person has at most one default actor profile | partial unique index `actor_profiles_one_default` |
| DR-08 | A workflow transition is unique per `(tenant, action, from_status)` | `@@unique` on `workflow_transitions` |
| DR-09 | Role eligibility for an action lives only in `workflow_action_role_permissions` | `from_role_id` dropped |
| DR-10 | No column stores what another table already knows | Phase 8 drop list |
| DR-11 | Agents propose schema changes; the owner or `database-architect` applies them | Art. IX |

DR-02 is the one that will bite. Every existing code path assumes an unscoped read succeeds
when no tenant is set — the relay depends on it. That is why Phase 6 lands the privileged role
in the same migration as the policies, not after.

## Failure modes

| Condition | Effect |
|---|---|
| Code forgets `SET LOCAL app.tenant_id` | Scoped reads return zero rows. Loud and immediate, not a silent cross-tenant read. |
| Nested `connect` names a foreign-tenant id | On a guarded chain: FK violation → P2003 → 409. Elsewhere: RLS hides the row, so `connect` cannot resolve it. |
| Direct `INSERT` names a known foreign-tenant UUID | Postgres runs FK validation as the table owner and **does not apply RLS to the referenced row** — only the composite key stops this. This is why Phase 7 exists at all. |
| Relay runs with the app role instead of the privileged one | Reads zero unpublished rows across every tenant. Backlog grows visibly rather than draining wrongly. |
| A new model gains `tenant_id`, the constants file is not updated | `prebuild` fails. Today: silently unscoped. |
| Backfill leaves a member with no matching person | Migration's `NOT NULL` on `person_id` fails the migration. Nothing half-applied. |
| Two members share one user account today | Backfill collapses them onto one `Person`; the `@@unique([tenantId, personId, divisionId])` catches a genuine duplicate affiliation. |
| Lookup table collapsed while a FK still points at it | Migration fails on the dependent constraint. Order in `plan.md` §4 exists for this. |

## EARS acceptance criteria

- `[AC-U01]` Every tenant-scoped table SHALL have row-level security enabled and an isolation policy.
- `[AC-U02]` The application database role SHALL NOT be able to read a row belonging to another tenant.
- `[AC-U03]` A person's name and email SHALL exist in exactly one table.
- `[AC-U04]` No column SHALL store a value another table already holds, unless it is a deliberate point-in-time snapshot named in `DATA_CONTRACT.md` §5.
- `[AC-E01]` WHEN a write names a foreign-tenant id on a guarded chain, the database SHALL reject it.
- `[AC-E02]` WHEN a unit of work opens, it SHALL set `app.tenant_id` before any statement runs.
- `[AC-E03]` WHEN a model declaring `tenantId` is added without updating `TENANT_SCOPED_MODELS`, `yarn build` SHALL fail.
- `[AC-E04]` WHEN an `actor_profile` is written whose kind disagrees with its populated reference, the database SHALL reject it.
- `[AC-S01]` WHILE no tenant GUC is set, a scoped table SHALL return no rows to the application role.
- `[AC-S02]` WHILE the relay holds the privileged role, it SHALL continue to drain the outbox across every tenant.
- `[AC-W01]` IF a second default actor profile is written for a person, THEN the database SHALL reject it.
- `[AC-W02]` IF a workflow transition duplicates an existing `(tenant, action, from_status)`, THEN the database SHALL reject it.

## Out of scope

Which events these tables publish (each owning module) · the HTTP surface over `Person` (03 and
05) · query tuning and index strategy beyond what the constraints require · moving to
schema-per-tenant or database-per-tenant (rejected, see decision 4) · pruning and retention of
`outbox_messages` (13) · the `folder_path` rebuild job if the owner keeps it as a cache rather
than dropping it (08) · restoring the deleted DBML (module 01's open deviation, and a
precondition for any of this — see `plan.md` §1).

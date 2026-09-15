# Technical Plan: 01.1 — Schema Integrity & Tenant Isolation

**Status:** Gate 5 · verified corrected design
**Related:** `SPEC.md` · `DATA_CONTRACT.md`

## 1. Preconditions

- Authoritative DBML and the P-1 generator parity baseline are restored and preserved.
- Phase 7 is prepared and must remain unchanged until its administrative preflight can run.
- NestJS runtime configuration contains only `DATABASE_URL` (`app_user`) and
  `DATABASE_URL_PRIVILEGED` (`app_relay`). For a migration command/session only, temporarily
  expose the provider/table-owner connection as `DATABASE_URL`, because `prisma.config.ts`
  reads that name. Never persist it in the runtime `.env`; restore the normal app runtime
  environment after the migration session. If it is unavailable, prepare artifacts and leave
  database leaves unticked.
- Application startup connects both runtime clients but does not query or enforce literal role
  names through `assertDatabaseRole`; role attributes and separation remain deployment/catalog
  verification responsibilities.

## 2. Dependency order

1. Phase 5 static tenant-scope enforcement.
2. Phase 6 runtime roles, grants, RLS, and runtime verification.
3. Phase 7 tenant-carrying FKs and document/project coherence.
4. Phase 8 organization consistency constraints.
5. Phase 9 exact-active-transition duplicate prevention.
6. Phase 10 retained identity assertions (no migration).
7. Phase 11 ActorProfile check and partial default uniqueness.
8. Phase 12 generator-only WorkPriority correction and retained-data assertions.
9. Phase 13 static close-out, followed by database verification when credentials exist.

Phase 8–11 SQL is grouped into `20260902010000_harden_retained_architecture` because it is one
dependency-safe, additive constraint migration. It may run only after Phase 7 is applied.

## 3. Schema pipeline

1. Edit DBML only for representable structural changes: Division company/tenant handle and
   composite Member/Team division references.
2. Extend only the generator's singularization rule needed for `work_priorities`.
3. Generate Prisma and prove a second generation is byte-identical.
4. Keep PostgreSQL-only partial/NULL-safe indexes and CHECKs in the reviewed migration; document
   them in the DBML contract because Prisma/DBML cannot express their full semantics.
5. Validate Prisma, generate the client, update compile-time consumers atomically, then lint/build.

## 4. Preflight and execution

Run `phase7-preflight.sql` first; every query must return zero rows. Apply Phase 7 and run its
named verification. Then run `phase8-12-preflight.sql`; every query must return zero rows before
applying `20260902010000_harden_retained_architecture`. Stop on any row; never repair business
data automatically. Finally run `phase8-12-verification.sql` and require every named assertion
to report true.

## 5. Compatibility

- No columns, lookup tables, workflows, roles, permissions, assignments, documents, snapshots,
  folders, or API payloads are removed.
- Nullable workflow roles remain nullable. Exact duplicate prevention includes every current
  transition configuration field and is limited to active rows.
- System Administrator stays representable by an ActorProfile with neither business target.
- WorkPriority changes only the generated Prisma API spelling; table/column mappings stay fixed.
- Prime Consultant and the removed PM client-revision route are not reintroduced.

## 6. Rollback

- Phase 7 uses its existing symmetrical rollback unchanged.
- `phase8-12-rollback.sql` reverses only the new constraints/indexes and restores original
  Member/Team division FKs with NO ACTION behavior.
- Generator naming can be reverted independently because it has no database effect.
- RLS rollback remains the separately reviewed Phase 6 procedure.

## 7. Verification

Static: isolated generation parity, generator idempotence, Prisma validation/client generation,
tests, lint, build, `verify:spec`, Module 01.1 SDD checks (including unticked probes), strict SDD,
and `git diff --check`. Runtime/catalog: read-only preflights and exact named post-verification
through the temporary provider/table-owner migration session.

# Work Request Implementation Status

**Current authoritative specs:** `specs/10-work-requests/**`.

Codex MUST update this file after every implementation phase. Valid phase statuses are exactly `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, and `COMPLETE`; readiness is exactly `READY` or `NOT_READY`. A phase is `COMPLETE` only after its runbook Completion Gate and strict policy pass. A known in-scope defect, incomplete task, failed applicable validation, TODO/FIXME, temporary bypass, unresolved migration issue, or skipped owner requirement makes `COMPLETE` and successor `READY` forbidden. Never claim a production/remote migration was applied without proof.

## Overall

**Status:** BLOCKED

**Current phase execution:** Phase 2 - BLOCKED.

| Phase | Status | Completion-gate evidence/date | Migrations created / validation DB status | Permissions reused/added | Runtime decisions | Tests/validation | Known defects / limitations | Blocker | Next phase readiness |
|---|---|---|---|---|---|---|---|---|---|
| 1 - Permission Catalogue & Implementation Design | COMPLETE | 2026-10-21: all Phase 2-7 commands mapped; Phase 1 self-review clear | N/A | Reused existing generic codes; none added | Catalogue/design only; no route runtime, schema, migration, 10.1, or 10.2 runtime change | Focused mapper Jest (10 pass), focused ESLint, build, SDD module strict, verify:spec, and diff check PASS | NONE | - | READY |
| 2 - Persistence, RLS, Constraints & Cutover | BLOCKED | 2026-10-21: additive schema/migration reviewed; static gates pass | Prepared `20261021000000_add_work_request_route_persistence`; not applied | Phase 1 catalogue only | Persistence/cutover only; no workflow endpoints or C1 behavior change | Prisma generate, tenant-scope check, build, prior Phase 1 regression, spec/SDD, diff PASS | No known code defect | Target DB P3009: failed C3 migration blocks all later migrations | NOT_READY |
| 3 - Internal Routing Runtime | NOT_STARTED | - | Uses Phase 2 persistence | - | - | - | NONE | - | NOT_READY |
| 4 - Formal Revision Runtime | NOT_STARTED | - | Uses Phase 2 persistence | - | - | - | NONE | - | NOT_READY |
| 5 - Communications | NOT_STARTED | - | Uses Phase 2 persistence | - | - | - | NONE | - | NOT_READY |
| 6 - C1 External Client Delivery | NOT_STARTED | - | Uses Phase 2 persistence | - | - | - | NONE | - | NOT_READY |
| 7 - C3 Readiness | NOT_STARTED | - | Uses Phase 2 persistence | - | - | - | NONE | - | NOT_READY |

## Phase 1 completion record

**Status:** COMPLETE

**Catalogue result:** Existing generic permissions are sufficient. No permission enum, scope compatibility, provisioning, reconciliation, schema, or migration change is required.

**Authorization policy:** Every Phase 2-7 command has an existing generic capability mapping plus compatible scope and exact responsibility. Authorization fails closed unless permission, scope, active same-tenant actor, resource relationship, exact responsibility, and workflow context all hold. No role/name authorization or tenant-super-admin workflow bypass exists.

**Validation:** Focused mapper Jest (10 tests), focused ESLint, build, module-strict SDD verification, global spec verification, and `git diff --check` pass.

**Compatibility:** C1 exact package/client decision mappings and C3 readiness behavior are unchanged; no runtime behavior was modified.

**Known defects / limitations:** NONE.

**Next phase readiness:** READY.

## Phase 2 current record

**Status:** BLOCKED

**Prepared persistence:** Additive route root/version/step, Division cycle, Team/Member sequence,
revision/resume, append-only event/projection, private conversation/message/attachment, and
reconsideration persistence are prepared in the Prisma schema and migration. Route records carry
tenant-qualified foreign keys, active/ordinal/idempotency constraints, RLS policies, least grants,
append-only protections, and a cutover trigger. The trigger rejects legacy rows and enforces that
the route's Bid, Direct Project, and C3 cycle exactly match its V1 anchor.

**Legacy/cutover:** The migration does not update, reparent, fabricate, or delete V1, C1, C2, or
C3 records. It establishes a route cutover marker; historical V1 rows remain without a route
extension.

**Static validation:** `corepack yarn prisma:generate`, tenant-scope verification via
`corepack yarn build`, focused Phase 1 mapper regression (10 tests), `corepack yarn verify:spec`,
`node scripts/verify-sdd.mjs --strict --module 10`, and `git diff --check` pass.

**Blocker:** The Phase 2 Completion Gate requires fresh disposable PostgreSQL migration,
catalogue, RLS, constraint, append-only, idempotency, and legacy-preservation evidence. The
owner's 2026-10-21 `corepack yarn prisma:deploy` attempt against `hatechz-dev` stopped with
`P3009` before this migration: `20261016000000_add_bid_c3_business_cycles` is recorded as
failed. Its exact database error and resulting catalog state must be reviewed before any
`prisma migrate resolve` or retry. The Phase 2 migration was not applied.

**Next phase readiness:** NOT_READY.

For each update, record exact command outcome and dates in the phase row or the current-phase record, retain known defects until resolved, and set the successor `READY` only when the preceding phase is complete and its Next-Phase Readiness Gate passes.

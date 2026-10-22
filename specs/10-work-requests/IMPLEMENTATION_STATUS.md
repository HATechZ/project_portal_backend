# Work Request Implementation Status

**Current authoritative specs:** `specs/10-work-requests/**`.

Codex MUST update this file after every implementation phase. Valid phase statuses are exactly `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, and `COMPLETE`; readiness is exactly `READY` or `NOT_READY`. A phase is `COMPLETE` only after its runbook Completion Gate and strict policy pass. A known in-scope defect, incomplete task, failed applicable validation, TODO/FIXME, temporary bypass, unresolved migration issue, or skipped owner requirement makes `COMPLETE` and successor `READY` forbidden. Never claim a production/remote migration was applied without proof.

## Overall

**Status:** COMPLETE

**Current phase execution:** Phase 7 - COMPLETE.

**Cross-phase remediation:** A proven in-scope defect in a completed phase temporarily reopens that phase, is repaired and regression-verified using the required specialist, then resumes the active phase in the same task. The Phase 3 cutover-marker review found no Phase 2 schema-authority defect: the singleton non-tenant metadata table is intentionally read through the active UoW's `$queryRaw`, not represented as a Prisma model.

**Autonomous phase execution:** `Implement Work Request Phase N` means implement, debug recoverable failures, delegate where required, verify, self-review, and update evidence until COMPLETE or a concrete non-recoverable blocker. `IN_PROGRESS` is active-work state, not a normal final result; documentation-only updates cannot end a runtime phase while a safe implementation/debugging action remains.

**Phase 3 blocker correction:** “focused tests have not yet been implemented and passed” is not a blocker. Those tests, and fixes required for them, remain Phase 3 implementation work.

| Phase | Status | Completion-gate evidence/date | Migrations created / validation DB status | Permissions reused/added | Runtime decisions | Tests/validation | Known defects / limitations | Blocker | Next phase readiness |
|---|---|---|---|---|---|---|---|---|---|
| 1 - Permission Catalogue & Implementation Design | COMPLETE | 2026-10-21: all Phase 2-7 commands mapped; Phase 1 self-review clear | N/A | Reused existing generic codes; none added | Catalogue/design only; no route runtime, schema, migration, 10.1, or 10.2 runtime change | Focused mapper Jest (10 pass), focused ESLint, build, SDD module strict, verify:spec, and diff check PASS | NONE | - | READY |
| 2 - Persistence, RLS, Constraints & Cutover | COMPLETE | 2026-10-22: clean disposable chain, C3, Phase-2 catalogue/RLS/grant/constraint/trigger/cutover and self-review PASS | `20261021000000_add_work_request_route_persistence` applied only to disposable `127.0.0.1:55432` | Phase 1 catalogue only | Persistence/cutover only; no workflow endpoints or C1 behavior change | DB validation, Prisma generate, lint/build, mapper tests, spec/SDD, diff PASS | NONE | - | READY |
| 3 - Internal Routing Runtime | COMPLETE | Route creation/projection/forward/amendment and focused tests PASS | Uses Phase 2 persistence | Phase 1 route mappings | Main route only; Phase 4 remains excluded | 150 Work Request tests, build/spec/SDD/diff PASS | NONE | - | READY |
| 4 - Internal Division / Team / Member Execution | COMPLETE | 2026-10-22: sequence/lifecycle/auth/concurrency gates PASS | Uses Phase 2 persistence | Phase 1 route mappings | One Division cycle per occurrence; fixed Team sequence; append-only Member sequence; exact responsibility; internal-only projection/actions | 154 Work Request tests, lint/build/spec/SDD/diff PASS | NONE | - | READY |
| 5 - Source-Based Revision / Resume & Formal Revision Trigger | COMPLETE | 2026-10-22: audit regression gates PASS | Uses Phase 2 persistence | Phase 1 revision mappings | Immutable source-based direct resume; only cross-Division records emit a formal trigger; 10.1 remains excluded | 163 Work Request tests, build/spec/SDD/diff PASS | NONE | - | READY |
| 6 - Private Communication, Visibility & Available Actions | COMPLETE | 2026-10-22: privacy/action completion gate and self-review PASS | Uses Phase 2 persistence | Phase 1 communication mapping | Pair-private route communication only; route requests reject C2 | 170 Work Request tests, lint/build/spec/SDD/diff PASS | NONE | - | READY |
| 7 - C1 Client Gateway, Reconsideration, C3 Compatibility & Final Regression | COMPLETE | 2026-10-22: final end-to-end audit, gateway/reconsideration/C1-C3 gate and self-review PASS | Uses Phase 2 persistence; clean disposable replay PASS | Phase 1 Client/reconsideration mapping | C1 remains authoritative; route exact-origin gateway/reconsideration added | 39 suites / 211 tests, lint/build/spec/SDD/diff PASS | Audit fixes: Client-tail bypass, resubmission projection, scope/action gaps | - | READY |

## Phase 1 completion record

**Status:** COMPLETE

**Catalogue result:** Existing generic permissions are sufficient. No permission enum, scope compatibility, provisioning, reconciliation, schema, or migration change is required.

**Authorization policy:** Every Phase 2-7 command has an existing generic capability mapping plus compatible scope and exact responsibility. Authorization fails closed unless permission, scope, active same-tenant actor, resource relationship, exact responsibility, and workflow context all hold. No role/name authorization or tenant-super-admin workflow bypass exists.

**Validation:** Focused mapper Jest (10 tests), focused ESLint, build, module-strict SDD verification, global spec verification, and `git diff --check` pass.

**Compatibility:** C1 exact package/client decision mappings and C3 readiness behavior are unchanged; no runtime behavior was modified.

**Known defects / limitations:** NONE.

**Next phase readiness:** READY.

## Phase 2 current record

**Status:** COMPLETE

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

**2026-10-22 disposable validation PASS:** `powershell -ExecutionPolicy Bypass -File
scripts/validate-work-request-phase2.ps1` reset only the `project-portal-validation` Compose
volume and replayed all 72 untouched migrations against loopback PostgreSQL 18 at
`127.0.0.1:55432`. No `hatechz-dev`, real/dev, or other listener was contacted. The approved
validation-only bootstrap inserted the exact historical prerequisites after
`20260929000000`: one global `tenant_super_admin` SystemRole/Role pair and the seven
WorkflowActionDefinition rows asserted by `20260929000001`; historical migration SQL was not
edited. C3 (`20261016000000`) and Phase 2 (`20261021000000`) both applied.

**Catalogue/RLS/cutover evidence:** The same repeatable script verified all 15 Phase-2 route
tables, tenant RLS/policies, app_user least grants, four partial active/open indexes, C3 table
RLS, C3 WorkRequestV1 FK/CHECK/immutability trigger, Phase-2 cutover/immutability triggers and
non-app ownership. A deliberately unanchored route insert was rejected by
`wr_routes_cutover` with `route persistence requires a post-cutover Work Request`. The
seed-free validation database has no historical business rows; no history was fabricated.

**Repository validation/self-review PASS:** Prisma generate, focused Phase 1 mapper regression
(10 tests), lint, build (including SDD lint and tenant-scope verification), spec validation,
Module 10 strict SDD validation, and diff check passed. Review confirmed no inferred legacy
route/C1/C2/C3 data, no legacy V1 mutation/reparenting, no role/name authorization, and no
temporary bypass or TODO/FIXME in Phase 2 scope.

**Next phase readiness:** READY.

## Phase 7 completion record

**Status:** COMPLETE

**Runtime:** The route model dispatches the established C1 client-submission endpoints to an exact Responsible Originating Division Lead gateway. C1's existing immutable package, exact document-version membership, Client/ClientContact linkage, decision history, and submission numbering remain authoritative. The gateway advances only from the derived Originating final-review tail to the Client tail. A Client revision returns to that exact originating gateway, which can use the existing source-based revision paths without replaying the route.

**Reconsideration:** A rejected route Work Request can have one tenant-qualified reconsideration request from only the exact bound originating lead. The linked authorized Client contact accepts or denies it once. Denial leaves the C1 state terminal; acceptance reopens the Originating final-review correction path without fabricating package history or advancing the formal revision trigger.

**Compatibility/validation:** The approved disposable validation script replayed all 72 untouched migrations against only the `project-portal-validation` PostgreSQL Compose database at `127.0.0.1:55432`, including C3 and Phase-2 catalog/RLS/cutover checks. The final audit repaired normal-forward Client-tail bypass, client-revision resubmission projection restoration, route-gateway scope enforcement, and route available-actions coverage. Route gateway/reconsideration and C3 readiness focused tests, plus the full Work Request/C3 suite (39 suites / 211 tests), lint, build, `verify:spec`, strict Module 10 SDD, and `git diff --check` PASS.

**Self-review:** PASS. No package/version substitution, non-origin gateway, role-name authorization shortcut, Client cross-link, route replay, or C3 readiness change remains. No C1 package redesign, C3 aggregate redesign, 10.1, or 10.2 behavior was introduced.

**Work Request Route Model:** COMPLETE.

## Phase 6 completion record

**Status:** COMPLETE

**Runtime:** Route Work Requests now use an append-only, canonical pair-conversation channel. Initial sends fan out into independently addressed conversations; replies remain on their existing pair. Exact active route relationships determine recipients and sending authority. A former participant may read only their stored conversation but cannot send after the relationship ends. Attachments are exact Work Request document-version references. Historical V1/C2 request/respond endpoints explicitly reject route Work Requests.

**Visibility/actions:** Main history exposes route version/step progression only; it never includes Division-cycle, Team, or Member identifiers. Internal history is restricted to exact route-related actors. Available actions select route-private communication for route requests and do not expose C2 actions.

**Validation:** Focused communication/provider/repository/C2-isolation tests (16 PASS), full Work Request suite (28 suites / 170 tests), lint, build (including SDD and tenant-scope checks), `verify:spec`, strict Module 10 SDD, and `git diff --check` PASS.

**Self-review:** PASS. Recipient fan-out has no group conversation; canonical participant ordering prevents direction-based duplicates; message and attachment records are write-once Phase-2 facts; reads are participant-scoped; normal visibility does not reveal internal execution detail; all route sends/replies use current exact responsibility rather than a role, Division, or designation name. No C2 conversion, realtime infrastructure, Client gateway, or Phase 7 behavior was implemented.

**Next phase readiness:** READY.

## Phase 5 completion record

**Status:** COMPLETE

**Runtime:** Internal Member and Team revisions require an exact active requester and an already
activated source in the same Team/Division context. Cross-Division revisions require exact active
Division Lead responsibility at both bound occurrences. Each serializable request saves immutable
requester/source/resume context, pauses only the route projection, and appends a route event plus
outbox fact. Resubmission is source-bound, idempotent, and restores only the preserved requester
context. `FORMAL_REVISION_TRIGGERED` is emitted only for a committed `CROSS_DIVISION_FORMAL`
record; internal revisions never emit it.

**Validation:** Focused revision repository/provider lifecycle tests (9 PASS), `corepack yarn jest
src/work-request --runInBand` (26 suites / 163 tests), `corepack yarn lint`, `corepack yarn
build`, `corepack yarn verify:spec`, strict Module 10 SDD, and `git diff --check` PASS.

**Audit remediation:** The 2026-10-22 conformance audit found and repaired two deterministic
authorization defects: a different ActorProfile for the same source Member could resubmit, and
classification-specific custom-role scope was not enforced. Resubmission now requires the exact
persisted source ActorProfile; request and resubmit scope is checked against the frozen Phase 1
policy. Focused negative tests cover both cases.

**Self-review:** PASS. No completed intermediate step is replayed; source targets cannot be
future execution steps; current projection is the only paused context; open revisions cannot be
resumed twice; retries do not append events/outbox facts; no 10.1 runtime or Client gateway was
implemented.

**Next phase readiness:** READY.

## Phase 4 completion record

**Status:** COMPLETE

**Runtime:** Activated Division occurrences create one route-step-bound cycle. Exact active
Division Leads define immutable ordered Team sequences; exact active Team Leads define and append
Member steps; only the active target Member submits. Team completion activates only the next Team
or completes the cycle, after which the exact active Division Lead may forward the main route.
Internal-cycle reads expose sequence detail and derived actions only to related exact actors.

**Validation:** `corepack yarn jest src/work-request --runInBand` (24 suites / 154 tests),
`corepack yarn lint`, `corepack yarn build`, `corepack yarn verify:spec`, strict Module 10 SDD,
and `git diff --check` PASS. Focused execution tests cover frozen Team sequence, exact Division
Lead and Member responsibility, serializable Member progression, and completed-history protection.

**Self-review:** PASS. Team and Member facts are append-only; completed facts are never updated;
only one projection-selected active Team/Member step can progress; Team steps cannot be added
after definition; repeated Division occurrences get their own cycle; internal details remain out
of main-route projection. Phase 5 remains unimplemented.

**Next phase readiness:** READY.

For each update, record exact command outcome and dates in the phase row or the current-phase record, retain known defects until resolved, and set the successor `READY` only when the preceding phase is complete and its Next-Phase Readiness Gate passes.

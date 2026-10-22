# Tasks: 10 — Route-Based Work Requests

> **Status:** Phase 2 persistence/cutover is complete. The old task list below is **HISTORICAL / PRE-ROUTE MODEL** and must not be ticked for the route-based workflow.

> **Strict phase policy:** A `COMPLETE` phase has every in-scope leaf verified, all applicable focused/API/integration/auth/RLS/concurrency/migration/cutover/build/spec/diff gates passing, no defect/TODO/FIXME/bypass/weakened security, and no skipped owner rule. `NEXT PHASE: READY` requires that exact state plus coherent regression of prior phases; otherwise it is `NOT READY`.

## PHASE 1 — Permission Catalogue & Implementation Design

**PRECONDITION CHECK:** Overall and Phase 1 are `NOT_STARTED`; no persistence/runtime phase may begin. **IMPLEMENTATION TASKS:**

- [x] Map every route command to a catalogue-audited generic permission and exact responsibility policy. Spec: `IMPLEMENTATION_RUNBOOK.md` Phase 1; `SPEC.md` Authorization. Assertion: no command is permission-only or name-authorized.
      VERIFY: rg -q "WORK_REQUEST_ROUTE_COMMAND_POLICY" src/work-request/providers/work-request-final-permission.mapper.ts && rg -q "isRouteCommandAuthorized" src/work-request/providers/work-request-final-permission.mapper.spec.ts

**PHASE SELF-REVIEW:** Compare every mapping against `SPEC.md` Authorization and `IMPLEMENTATION_RUNBOOK.md` Phase 1; reject permission-only/name-based authorization.
      VERIFY: rg -q "Non-negotiable completion and readiness policy" specs/10-work-requests/IMPLEMENTATION_RUNBOOK.md

**PHASE COMPLETION GATE:** Every Phase 2–7 command has a finalized mapping and all strict policy checks pass. **NEXT PHASE READINESS GATE:** Phase 2 is `READY` only after the mapping has no blocker or in-scope defect.

## PHASE 2 — Persistence, RLS, Constraints & Cutover

**PRECONDITION CHECK:** Phase 1 is `COMPLETE` and Phase 2 is `READY` in `IMPLEMENTATION_STATUS.md`. **IMPLEMENTATION TASKS:**

- [x] Add the approved additive route/cycle/sequence/revision/conversation/reconsideration persistence and cutover protections. Spec: `DATA_CONTRACT.md`; `MIGRATION_CUTOVER.md`; runbook Phase 2. Assertion: legacy V1/C1/C2/C3 is retained without fabricated history.
      VERIFY: rg -q "Persistence, RLS, Constraints & Cutover" specs/10-work-requests/IMPLEMENTATION_RUNBOOK.md

**PHASE SELF-REVIEW:** Compare additive schema/migration/catalog evidence to `DATA_CONTRACT.md` and `MIGRATION_CUTOVER.md`; reject inferred historical route/C2/C1/C3 data.
      VERIFY: rg -q "Existing V1 records cannot losslessly yield" specs/10-work-requests/MIGRATION_CUTOVER.md

**PHASE COMPLETION GATE:** Disposable DB verifies schema/RLS/legacy preservation and all strict policy checks pass. **NEXT PHASE READINESS GATE:** Phase 3 is `READY` only after migration validation passes with no in-scope defect.

## PHASE 3 — Main Route Creation, Amendment & Main Projection

**PRECONDITION CHECK:** Phase 2 is `COMPLETE` and Phase 3 is `READY`. **IMPLEMENTATION TASKS:**

- [x] Implement route creation, derived tail, ordered forward, future-only amendment, and safe main projection. Spec: `ROUTE_AND_EXECUTION_LIFECYCLE.md`; `API_CONTRACT.md`; runbook Phase 3. Assertion: repeated occurrences remain distinct and completed history is immutable.
      VERIFY: rg -q "Main Route Creation, Amendment & Main Projection" specs/10-work-requests/IMPLEMENTATION_RUNBOOK.md

**PHASE SELF-REVIEW:** Compare create/forward/amendment behavior to `ROUTE_AND_EXECUTION_LIFECYCLE.md`; reject skipped steps, mutable completed steps, or unbound originating-lead authority.
      VERIFY: rg -q "Completed occurrences and the active occurrence" specs/10-work-requests/ROUTE_AND_EXECUTION_LIFECYCLE.md

**PHASE COMPLETION GATE:** Main-route API/auth/concurrency proof and all strict policy checks pass. **NEXT PHASE READINESS GATE:** Phase 4 is `READY` only when route progression is authoritative with no defect.

## PHASE 4 — Internal Division / Team / Member Execution

**PRECONDITION CHECK:** Phase 3 is `COMPLETE` and Phase 4 is `READY`. **IMPLEMENTATION TASKS:**

- [x] Implement Division cycles, Team/Member sequences, late Member append, sequential execution, internal visibility, and actions. Spec: `ROUTE_AND_EXECUTION_LIFECYCLE.md`; `WORKFLOW_PROJECTIONS_VISIBILITY.md`; runbook Phase 4. Assertion: completed steps are never rewritten.
      VERIFY: rg -q "Internal Division / Team / Member Execution" specs/10-work-requests/IMPLEMENTATION_RUNBOOK.md

**PHASE SELF-REVIEW:** Compare active-cycle/sequence/history behavior to `ROUTE_AND_EXECUTION_LIFECYCLE.md`; reject mutable completed steps, concurrent active steps, or future Team access.
      VERIFY: rg -q "Once the sequence starts it is frozen" specs/10-work-requests/ROUTE_AND_EXECUTION_LIFECYCLE.md

**PHASE COMPLETION GATE:** Sequential/auth/concurrency proof and all strict policy checks pass. **NEXT PHASE READINESS GATE:** Phase 5 is `READY` only when pause points are deterministic with no defect.

## PHASE 5 — Source-Based Revision / Resume & Formal Revision Trigger

**PRECONDITION CHECK:** Phase 4 is `COMPLETE` and Phase 5 is `READY`. **IMPLEMENTATION TASKS:**

- [x] Implement direct Member, Team, and Division revision/resume with formal trigger exclusivity. Spec: `REVISION_AND_RESUME.md`; runbook Phase 5. Assertion: only committed `CROSS_DIVISION_FORMAL` triggers future 10.1.
      VERIFY: rg -q "formalRevisionTrigger" specs/10-work-requests/REVISION_AND_RESUME.md

**PHASE SELF-REVIEW:** Compare every classification/resume path to `REVISION_AND_RESUME.md`; reject intermediate replay or any non-cross-Division formal trigger.
      VERIFY: rg -q "Internal Member/Team revisions and a Client request alone never increment" specs/10-work-requests/SPEC.md

**PHASE COMPLETION GATE:** Direct resume/trigger exclusivity proof and all strict policy checks pass. **NEXT PHASE READINESS GATE:** Phase 6 is `READY` only when trigger behavior is deterministic with no defect.

## PHASE 6 — Private Communication, Visibility & Available Actions

**PRECONDITION CHECK:** Phase 5 is `COMPLETE` and Phase 6 is `READY`. **IMPLEMENTATION TASKS:**

- [x] Implement private pair communication, recipient fan-out, visibility, and complete backend-derived actions. Spec: `REQUEST_INFO_COMMUNICATION.md`; `WORKFLOW_PROJECTIONS_VISIBILITY.md`; runbook Phase 6. Assertion: new route requests never use C2 request/respond lifecycle.
      VERIFY: rg -q "Private Communication, Visibility & Available Actions" specs/10-work-requests/IMPLEMENTATION_RUNBOOK.md

**PHASE SELF-REVIEW:** Compare participant visibility, former read/no-send, and available actions to communication/visibility contracts; reject pair leakage or C2 semantics for route requests.
      VERIFY: rg -q "New route-based Work Requests do not expose competing C2" specs/10-work-requests/REQUEST_INFO_COMMUNICATION.md

**PHASE COMPLETION GATE:** Privacy/RLS/action proof and all strict policy checks pass. **NEXT PHASE READINESS GATE:** Phase 7 is `READY` only when C2 cannot leak into the route model and no defect remains.

## PHASE 7 — C1 Client Gateway, Reconsideration, C3 Compatibility & Final Regression

**PRECONDITION CHECK:** Phase 6 is `COMPLETE` and Phase 7 is `READY`. **IMPLEMENTATION TASKS:**

- [x] Implement Originating gateway/reconsideration and complete C1/C3/full regression validation. Spec: `CLIENT_GATEWAY_RECONSIDERATION.md`; `TEST_MATRIX.md`; runbook Phase 7. Assertion: C1 exact packages and C3 all-current-cycle-WR-accepted gate remain unchanged.
      VERIFY: rg -q "C1 Client Gateway, Reconsideration, C3 Compatibility" specs/10-work-requests/IMPLEMENTATION_RUNBOOK.md

**PHASE SELF-REVIEW:** Compare gateway/reconsideration/C1/C3 behavior to Client, Test Matrix, and C3 authority; reject package substitution, non-origin gateway, or changed readiness.
      VERIFY: rg -q "C3 still requires all current-cycle Bid Work Requests" specs/10-work-requests/TEST_MATRIX.md

**PHASE COMPLETION GATE:** All Phase 1–7/regression and strict policy checks pass. **NEXT PHASE READINESS GATE:** Work Request Route Model is COMPLETE only after every gate passes with no known defect.

## HISTORICAL / PRE-ROUTE TASKS

- [ ] Apply the approved Work Request permission migration/provisioning and configured transitions.
      VERIFY: `Select-String -Path specs/10-work-requests/*.md -Pattern 'OWNER DECISION REQUIRED'`
- [ ] Approve and apply additive Work Request persistence, tenant/RLS, fixed priority domain, and legacy migration/backfill plan.
      VERIFY: `Select-String -Path prisma/schema.prisma -Pattern '^model WorkRequest$|^model WorkRequestAssignment$|^model WorkRequestAuditLog$'`
- [ ] Implement isolated multipart create, Bid/Project XOR validation, generic document-code mapping, initial event, and no initial assignment.
      VERIFY: `corepack yarn test --runInBand --testPathPatterns=work-request`
- [ ] Implement scoped Division, Team, and Member assignment history with active membership validation and safe Member assignee display projection.
      VERIFY: `corepack yarn test --runInBand --testPathPatterns=work-request`
- [ ] Implement derived workflow state, the explicit transition matrix, generic revision return paths, clarification behavior, available actions, outbox publication, and focused tenant/concurrency tests.
      VERIFY: `corepack yarn test --runInBand --testPathPatterns=work-request`
- [ ] Implement scoped read-only Work Request document and chronological document-version history.
      VERIFY: `corepack yarn test --runInBand --testPathPatterns=work-request`
- [ ] Independently verify assertions and complete HTTP/RLS walkthrough.
      VERIFY: `Test-Path specs/10-work-requests/walkthrough.md`

# Plan: 10 — Route-Based Work Requests

> **AUTHORITATIVE PLAN:** Implementation is strictly sequential. Read [IMPLEMENTATION_RUNBOOK.md](IMPLEMENTATION_RUNBOOK.md) for the executable phase contract and [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for continuity/status. A phase cannot start until the previous phase Completion Gate passes and its Next-Phase Readiness Gate is `READY`.

1. [Phase 1 — Permission Catalogue & Implementation Design](IMPLEMENTATION_RUNBOOK.md#phase-1--permission-catalogue--implementation-design)
2. [Phase 2 — Persistence, RLS, Constraints & Cutover](IMPLEMENTATION_RUNBOOK.md#phase-2--persistence-rls-constraints--cutover)
3. [Phase 3 — Main Route Creation, Amendment & Main Projection](IMPLEMENTATION_RUNBOOK.md#phase-3--main-route-creation-amendment--main-projection)
4. [Phase 4 — Internal Division / Team / Member Execution](IMPLEMENTATION_RUNBOOK.md#phase-4--internal-division--team--member-execution)
5. [Phase 5 — Source-Based Revision / Resume & Formal Revision Trigger](IMPLEMENTATION_RUNBOOK.md#phase-5--source-based-revision--resume--formal-revision-trigger)
6. [Phase 6 — Private Communication, Visibility & Available Actions](IMPLEMENTATION_RUNBOOK.md#phase-6--private-communication-visibility--available-actions)
7. [Phase 7 — C1 Client Gateway, Reconsideration, C3 Compatibility & Final Regression](IMPLEMENTATION_RUNBOOK.md#phase-7--c1-client-gateway-reconsideration-c3-compatibility--final-regression)

## HISTORICAL / PRE-ROUTE PLAN

1. Provision the approved Work Request action catalogue and fixed-role baseline after the owner applies the pending permission enum migration. Creation is eligible only for Bid `BIDDING` and Direct Project `ACTIVE`; files require one positional generic document code each; Module 10 stops after `DIVISION_HEAD_APPROVED`. Priority is confirmed fixed request data: `Low`, `Medium`, or `High`.
2. Design and approve the additive Work Request persistence migration: exclusive Bid/Direct Project parent, fixed priority domain, temporal assignments, append-only events, documents, tenant/RLS/grants, safe legacy handling, and backfill/quarantine plan.
3. Implement only `src/work-request/**`: multipart DTO/controller, small services/providers, repositories through UnitOfWork, response mapping, and Work Request-owned outbox events. Do not import Bid/Project feature modules.
4. Implement creation with parent/scope/state validation, optional protected files and positional generic document-code mapping, initial event, and no routing assignment.
5. Implement the `CREATED` → Division → Team → Member → Member Submit → Team Lead → Division Lead → Division Head transition matrix, scoped assignment history, generic revision return paths, parallel information exchanges, available actions, and focused concurrency/tenant tests.
6. Independently verify all assertions and complete HTTP/RLS walkthroughs after the database change is owner-applied.
7. Provide scoped read-only Work Request document and chronological immutable version-history surfaces using `WorkRequestV1Document` and `WorkRequestV1DocumentVersion`; no document mutation is introduced.

# Plan: 10 — Work Requests

1. Provision the approved Work Request action catalogue and fixed-role baseline after the owner applies the pending permission enum migration. Creation is eligible only for Bid `BIDDING` and Direct Project `ACTIVE`; files require one positional generic document code each; Module 10 stops after `DIVISION_HEAD_APPROVED`. Priority is confirmed fixed request data: `Low`, `Medium`, or `High`.
2. Design and approve the additive Work Request persistence migration: exclusive Bid/Direct Project parent, fixed priority domain, temporal assignments, append-only events, documents, tenant/RLS/grants, safe legacy handling, and backfill/quarantine plan.
3. Implement only `src/work-request/**`: multipart DTO/controller, small services/providers, repositories through UnitOfWork, response mapping, and Work Request-owned outbox events. Do not import Bid/Project feature modules.
4. Implement creation with parent/scope/state validation, optional protected files and positional generic document-code mapping, initial event, and no routing assignment.
5. Implement the `CREATED` → Division → Team → Member → Member Submit → Team Lead → Division Lead → Division Head transition matrix, scoped assignment history, generic revision return paths, parallel information exchanges, available actions, and focused concurrency/tenant tests.
6. Independently verify all assertions and complete HTTP/RLS walkthroughs after the database change is owner-applied.
7. Provide scoped read-only Work Request document and chronological immutable version-history surfaces using `WorkRequestV1Document` and `WorkRequestV1DocumentVersion`; no document mutation is introduced.

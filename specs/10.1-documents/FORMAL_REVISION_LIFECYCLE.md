# Formal Revision Lifecycle

**Status:** authoritative weekly-scope contract. **Boundary:** generic Work Request V1; C1/C2/C3 and the canonical Document/DocumentVersion lineage are preserved.

## Current behavior preserved

- V1 review returns already append `REVISION_REQUESTED` events and return the request to a generic responsible state; this is an event, not a durable formal revision aggregate.
- C1 stores immutable numbered client-submission packages of exact `WorkRequestV1DocumentVersion` IDs. Client `REQUEST_REVISION`, route, and resubmission remain authoritative and unchanged.
- Versions are append-only, per-document sequential records. Existing `revisionCode` (currently working naming such as `A`) and `versionNumber` are distinct facts.
- Legacy `WorkRequestRevisionRequest`, `WorkRequestRevisionSubmission`, and `WorkRequestRevisionDocument` must be audited for reuse but are not automatically the V1 aggregate: they do not override C1 package lineage or V1 responsibility/state rules.

## New required behavior

### Revision request

A tenant-owned `FormalRevisionRequest` is required unless an audit establishes an equivalent V1 persistent record. It has immutable identity, Work Request, requester actor, source (`INTERNAL_REVIEW` or `CLIENT_REVISION`), source event/client-decision context where applicable, note/reason, target generic responsibility (`MEMBER`, `CHECKING`, `APPROVAL`, or `FINAL_REVIEW`), target state, `roundNumber`, server-generated display code `REV-001`, requestedAt, status, and correlation/idempotency data.

`OPEN → SUBMITTED → CLOSED` is the only normal progression. A request may be closed only after a valid submission and any required route/resubmission fact. Cancellation is allowed only while OPEN, by the requester or a separately authorized configured workflow action, and is append-only/audited; it never deletes history. Exactly one active OPEN request may exist for `(tenant, workRequest, roundNumber)`; serializable creation allocates `max(roundNumber)+1`, starting at 1, and unique `(tenant, workRequest, roundNumber)` resolves concurrency. Display code is server-generated from the round and unique per Work Request; clients supply neither it nor status/round/target state.

Authorization is permission + compatible scope + same tenant/request + exact active responsibility/relationship + valid state. Internal review routing uses existing generic responsibilities only. Client-originated revision first follows C1 `CLIENT_REVISION_REQUESTED`; the exact EXTERNAL_REVIEW assignee routes it with existing `ROUTE_FOR_REVIEW`, then creates/links the formal internal request transactionally. No title, role name, custom code, department, or seniority is authority.

### Revision submission

A `FormalRevisionSubmission` is immutable and linked to one request: identity, tenant, request, submitter, submittedAt, optional note, sequence, and exact immutable version-item rows. A request can have multiple submissions/resubmissions while OPEN; each has increasing server-allocated sequence and the latest submitted sequence is the current attempt. Old submissions and items are never changed/deleted. Submission atomically verifies target responsibility/state, creates the snapshot, writes audit/outbox, and marks the request SUBMITTED; a later configured reopen/revision creates a new request round rather than mutating a closed history.

The frozen rule is **changed-documents snapshot**: a formal revision submission contains one or more changed DocumentVersions only. It is not a substitute for C1's complete/selected client package snapshot. Each item must be a completed version of a document owned by the exact Work Request in the same tenant; duplicate version IDs, foreign versions, and unrelated parent versions are rejected.

### Codes and version semantics

| Fact | Meaning | Allocation |
|---|---|---|
| request status | `OPEN/SUBMITTED/CLOSED/CANCELLED` lifecycle | server |
| revision round | formal request sequence per Work Request, starts 1 | serializable server allocation |
| request code | `REV-001` display identifier per Work Request | server |
| `DocumentVersion.revisionCode` | existing document naming/revision label (for example `A/B/C`) | existing document naming rule; unchanged |
| `DocumentVersion.versionNumber` | immutable chronological version sequence per Document | server, concurrency-safe |

Revision work always creates a new DocumentVersion; no version/file metadata is overwritten, no Document ownership moves, and clients never supply version number, revision code, storage key, actor, tenant, or generated filename.

## C1 compatibility

After a Client revision request: C1 decision → existing route to a generic responsibility → formal revision request/submission → existing `SUBMIT_CLIENT_REVISION` creates a new immutable C1 client package → `CLIENT_REVIEW`. Formal submission does not modify a prior C1 package and cannot bypass C1 package selection, ClientContact authorization, or client-decision rules.

## Required persistence, audit, and negative proof

Additive persistence only: request, submission, and submission-item tables with tenant-qualified FKs, immutable/history protection, RLS/grants, uniqueness above, and optional linkage to existing C1 decision/submission/event IDs. No change to DocumentVersion core semantics is required for formal linkage.

Audit/outbox facts: request created/cancelled/closed, submission created, exact versions frozen, and Client resubmission linkage. Required negatives: wrong tenant/actor, permission without responsibility, invalid state, foreign request/version, duplicate/concurrent round or submission, historic submission mutation, invalid round/code, and Client revision bypass of C1.

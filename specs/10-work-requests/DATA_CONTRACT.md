# Data Contract: 10 — Route-Based Work Requests

> **AUTHORITATIVE DATA CONTRACT:** The route-based concepts are additive future persistence. The pre-route V1 contract below is **HISTORICAL / PRE-ROUTE MODEL** retained for lossless read compatibility; it is not a schema blueprint for new route-based Work Requests. Exact target Prisma names/migration SQL are deferred until approved implementation design.

## Route-based persistence summary

The new model requires tenant-qualified, append-only/immutable history for route versions and route-step occurrences; one Division execution cycle per activated route occurrence; ordered Team steps per Division cycle; ordered Member steps per Team step; revisions/resume links; pair conversations/messages/attachments; and reconsideration history. `WorkRequestV1`, events, documents/versions, C1 package rows, C2 historical rows, and C3 Bid-cycle relation remain preserved. See [Route & Execution Lifecycle](ROUTE_AND_EXECUTION_LIFECYCLE.md), [Revision & Resume](REVISION_AND_RESUME.md), [Request Info Communication](REQUEST_INFO_COMMUNICATION.md), [Client Gateway & Reconsideration](CLIENT_GATEWAY_RECONSIDERATION.md), and [Migration Cutover](MIGRATION_CUTOVER.md).

Persist route position, internal-cycle position, revision pause/resume, and Client lifecycle as separate facts/projections; do not create one giant global enum or mutable status sufficient to reconstruct history. New tables require tenant-qualified FKs, RLS `USING`/`WITH CHECK`, least grants, sequence/one-active constraints, idempotency uniqueness, and append-only protections where specified.

The Work Request persists `originatingDivisionId` and `responsibleOriginatingDivisionLeadId` as separate tenant-qualified facts. The latter identifies the exact active DivisionLead responsibility bound at creation; it is not derivable from Division membership. A transfer requires a separate append-only responsibility-change record with predecessor, successor, actor, reason, timestamp, and correlation.

Conceptual relations are: `WorkRequestRouteVersion` (origin, responsible originating lead, predecessor/amendment and route plan); `WorkRequestRouteStep` (occurrence, ordinal, kind, Division, activation/completion); `WorkRequestDivisionCycle` (one per activated Division occurrence); `WorkRequestTeamStep` and `WorkRequestMemberStep` (parent cycle/step, ordinal, target, immutable lifecycle); `WorkRequestRevision` (classification, requester, actual source, exact contexts, resume destination, round, formal trigger); `WorkRequestConversation` (canonical pair per Work Request); `WorkRequestMessage` and immutable attachment references; and `WorkRequestReconsideration` with one request/decision history. These are conceptual names, not approved Prisma names.

## HISTORICAL / PRE-ROUTE DATA CONTRACT

## Redesign boundary

The current legacy `WorkRequest` is Project-only and requires category, attachment category, assigned/origin Division and mutable routing columns. Its generic `Document` parent is also legacy Project-only. V1 does not reuse those structures. A future approved migration must introduce the following target concepts without guessing a backfill from legacy data.

## Aggregate and parent invariant

Target Work Request has UUID `id`, `tenantId`, nullable `bidId`, nullable Project relation ID, `title`, fixed priority domain value, nullable `notes`, `createdByActorId`, `createdAt`, `updatedAt`, and an optional archive lifecycle only when separately approved. Physical Project relation naming follows Module 09’s direct Project redesign (for example, `directProjectId`); API terminology remains `projectId`.

`bidId` and `projectId` have tenant-qualified FKs to independent Bid and Direct Project records. A database CHECK requires exactly one non-null parent; service validation mirrors it. Index `(tenant_id, bid_id)` and `(tenant_id, project_id)` support parent detail/list reads. No parent type discriminator, workspace relation, category, legacy code, origin Division, or mutable current-assignment/status column is permitted.

Before creation, a repository validates same tenant, active/readable parent scope, and configured eligible parent state. Parent status is read from its latest parent event; it is not copied into Work Request.

## Fixed priority domain

Work Request stores `priority` directly as a fixed, required domain value: `Low`, `Medium`, or `High`. There is no priority ID, foreign key, reference/master table, CRUD API, lifecycle, seed, or provisioning. API/DTO validation is case-sensitive and rejects every other string. A future Prisma implementation may use an enum whose persisted values are exactly `Low`, `Medium`, and `High`; it must not introduce a priority relation.

## Assignment history

`WorkRequestV1Assignment.level` includes `DIVISION`, `TEAM`, `MEMBER`, `CHECKING`, `APPROVAL`, and `FINAL_REVIEW`. Reviewer levels hold only `memberId`; the active uniqueness rule is one non-replaced/non-unassigned row per request and level. `WorkRequestV1Event.responsibilityLevel` is nullable so historical events remain valid while generic workflow events snapshot the acting responsibility.

Assignment history may join the existing Member relation only for a safe display projection on
member-targeted rows: Member `id` and `name` map to response `assignee.id` and `assignee.label`.
No additional fields, table, relation, Prisma model, or stored assignment data are introduced.

## Phase C1 package, client submission, and decisions

`EXTERNAL_REVIEW` is another member-targeted assignment level. V1 client packages use tenant-owned `WorkRequestV1ClientSubmission` rows with unique `(tenantId, workRequestId, submissionNumber)` and immutable `WorkRequestV1ClientSubmissionItem` rows referencing exact tenant-owned `WorkRequestV1DocumentVersion` IDs. A submitted row is never edited; a resubmission is a new numbered row.

`WorkRequestV1ClientDecision` is tenant-owned, references one submission and the Work Request, records `ACCEPT`, `REJECT`, or `REQUEST_REVISION`, external actor/contact evidence, note, timestamp, correlation/idempotency, and is unique per submission. Events may reference the relevant submission/decision while historical events remain nullable. Tenant-qualified FKs, request/item ownership validation, event idempotency, and serializable writes protect cross-resource access and concurrent decisions.

Target assignment rows are tenant-owned UUID records with Work Request, level (`DIVISION`, `TEAM`, or `MEMBER`), exactly one matching Division/Team/Member target, `assignedByActorId`, `assignedAt`, nullable `unassignedAt`/`replacedAt`, and nullable reason/note. Tenant-qualified FKs apply where supported. A CHECK enforces target/level consistency; partial unique indexes permit at most one active target assignment per Work Request and level.

Division assignment requires active same-tenant Division. Team assignment requires active same-tenant Team belonging to the active assigned Division. Member assignment requires active same-tenant Member in that Team’s Division and active TeamMember membership (`leftAt IS NULL`). Reassignment closes then inserts in one serializable UnitOfWork. History answers responsibility at any time; current routing is the active row(s) projection.

## Events, audit, and information

Append-only Work Request events/audit have tenant, request, configurable action/event identity, nullable prior state, required resulting state where state changes, performer ActorProfile, occurredAt, note/comments, and correlation/idempotency metadata where platform supports it. Index latest reads by `(work_request_id, occurred_at DESC, id DESC)`. `WORK_REQUEST_CREATED`, assignment, submit, approval/rejection, revision, resubmit, reassignment, request-info, and respond-info are conceptual capabilities, not a closed enum.

Current state is latest event state with deterministic ID tie-breaker. A clarification record links request, requester, target/response, message, timestamps, and state-at-request; it does not alter current state absent an explicit configured transition.

The initial event has null prior state, resulting state `CREATED`, performer, occurrence time, and request correlation. Subsequent resulting states are the eight states in the transition matrix. Revision events retain reviewer, requested return level, source state, resulting return state, note, and correlation; no opaque `REVISION_REQUESTED` state may erase where responsibility returned. The event stream is the authoritative audit and state derivation source; any current-state or current-assignment projection is cache-only and transactionally maintained.

## Documents and tenancy

Target Work Request documents follow the independent Bid/Project document shape: tenant-qualified request parent, nullable generic `documentCodeId`, code snapshot where naming/classification needs it, original filename, generated filename when naming inputs exist, immutable protected storage key, MIME, size, uploader, timestamps, and version/classification history. Storage key is generated under the tenant/request namespace; it is never an external URL or caller input. `files[]` are optional. `files[i] ↔ documentCodeIds[i]` whenever code IDs are supplied; no partial mapping. Document code validation is tenant-valid, active, and generic—never module-specific code fields.

Every owned table carries tenant ownership, TenantContext repository predicates, RLS `USING`/`WITH CHECK`, least required grants, and no BYPASSRLS. Cross-tenant parent, organization, document code, file, event, assignment, and actor access is forbidden. RLS remains defense in depth.

## Document/version read contract

## Phase C2 nested information requests

`WorkRequestV1InfoRequest.parentInfoRequestId` is nullable and self-references the same tenant-qualified table. Root rows are null; child rows must reference a parent of the same Work Request, enforced by repository validation. Existing rows remain roots; no backfill is required. History is deterministic by request time and ID.

`WorkRequestV1DocumentVersion` is the immutable history relation for a `WorkRequestV1Document`. Reads use tenant-qualified document ownership and return chronological `uploadedAt ASC, id ASC` history. Future version creation inserts a new row; it never updates or replaces an historical row.

Information-request and response attachments are immutable tenant-owned joins to exact `WorkRequestV1DocumentVersion` rows. Command validation proves the referenced version belongs to the exact Work Request before insertion. Attachments never follow later versions and external reads expose them only when their containing clarification is participant-visible.

## C3 Bid business-cycle compatibility

C3 adds immutable Bid-cycle membership only for Bid-owned Work Requests: a new nullable `bidBusinessCycleId` is populated when `bidId` is populated and remains null when the exclusive DirectProject parent is populated. Its tenant-qualified compound foreign key proves the cycle belongs to the exact Bid. The approved C3 migration baseline explicitly enrolls every currently Bid-owned Work Request of each active/non-archived Bid into that Bid's newly created cycle 1. This deterministic one-time assignment preserves `bidId`, null Project parent, state, history, C1, and C2 data; it is not timestamp inference or reconstructed history. A legacy Bid already archived at baseline receives no such enrollment; when restored, its new first C3 active cycle starts without pre-C3 requests. Bid conversion never changes this parent invariant: historical Bid requests remain Bid-owned, while future Project requests are independently created with the DirectProject parent only.

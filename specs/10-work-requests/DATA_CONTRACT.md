# Data Contract: 10 — Work Requests

## Redesign boundary

The current legacy `WorkRequest` is Project-only and requires category, attachment category, assigned/origin Division and mutable routing columns. Its generic `Document` parent is also legacy Project-only. V1 does not reuse those structures. A future approved migration must introduce the following target concepts without guessing a backfill from legacy data.

## Aggregate and parent invariant

Target Work Request has UUID `id`, `tenantId`, nullable `bidId`, nullable Project relation ID, `title`, fixed priority domain value, nullable `notes`, `createdByActorId`, `createdAt`, `updatedAt`, and an optional archive lifecycle only when separately approved. Physical Project relation naming follows Module 09’s direct Project redesign (for example, `directProjectId`); API terminology remains `projectId`.

`bidId` and `projectId` have tenant-qualified FKs to independent Bid and Direct Project records. A database CHECK requires exactly one non-null parent; service validation mirrors it. Index `(tenant_id, bid_id)` and `(tenant_id, project_id)` support parent detail/list reads. No parent type discriminator, workspace relation, category, legacy code, origin Division, or mutable current-assignment/status column is permitted.

Before creation, a repository validates same tenant, active/readable parent scope, and configured eligible parent state. Parent status is read from its latest parent event; it is not copied into Work Request.

## Fixed priority domain

Work Request stores `priority` directly as a fixed, required domain value: `Low`, `Medium`, or `High`. There is no priority ID, foreign key, reference/master table, CRUD API, lifecycle, seed, or provisioning. API/DTO validation is case-sensitive and rejects every other string. A future Prisma implementation may use an enum whose persisted values are exactly `Low`, `Medium`, and `High`; it must not introduce a priority relation.

## Assignment history

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

`WorkRequestV1DocumentVersion` is the immutable history relation for a `WorkRequestV1Document`. Reads use tenant-qualified document ownership and return chronological `uploadedAt ASC, id ASC` history. Future version creation inserts a new row; it never updates or replaces an historical row.

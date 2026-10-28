# API Contract: 10 — Route-Based Work Requests

> **AUTHORITATIVE API:** This contract governs new route-based Work Requests. Routes in the retained pre-route section below are **HISTORICAL / PRE-ROUTE MODEL** compatibility endpoints only; they are not a target API for the route model. All routes inherit Module 00 envelope, error mapping, UUID validation, `x-request-id`, pagination, and guard conventions.

## Route-based surface

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/work-requests` | Create a route-based request with ordered intermediate Division IDs; server derives origin-final and Client tail. |
| GET | `/api/v1/work-requests/:id/route` | Main route/progress projection. |
| POST | `/api/v1/work-requests/:id/route-amendments` | Exact Responsible Originating Division Lead appends a versioned amendment to remaining future route steps. |
| GET | `/api/v1/work-requests/:id/internal-cycles/:cycleId` | Authorized Division/Team/Member execution projection. |
| POST | `/api/v1/work-requests/:id/division-cycles/:cycleId/team-sequence` | Define the active Division cycle's fixed ordered Team sequence. |
| POST | `/api/v1/work-requests/:id/team-steps/:teamStepId/member-sequence` | Define the active Team's ordered Member sequence. |
| POST | `/api/v1/work-requests/:id/team-steps/:teamStepId/member-steps` | Append a future Member step to the active Team sequence. |
| POST | `/api/v1/work-requests/:id/member-steps/:memberStepId/submit` | Submit current Member work. |
| POST | `/api/v1/work-requests/:id/team-steps/:teamStepId/complete` | Complete current Team work. |
| POST | `/api/v1/work-requests/:id/route-steps/:routeStepId/forward` | Normal forward only to the next approved route occurrence. |
| POST | `/api/v1/work-requests/:id/revisions` | Request internal Member, internal Team, or cross-Division formal revision. |
| POST | `/api/v1/work-requests/:id/revisions/:revisionId/resubmit` | Source correction returns directly to preserved requester/resume destination. |
| GET | `/api/v1/work-requests/:id/communication-recipients` | Context-valid exact people available to the caller. |
| POST | `/api/v1/work-requests/:id/conversations/messages` | Fan out one initial message to one or more exact recipients. |
| GET | `/api/v1/work-requests/:id/conversations/:conversationId` | Pair-only continuous conversation history. |
| POST | `/api/v1/work-requests/:id/conversations/:conversationId/messages` | Append a pair-conversation message. |
| GET | `/api/v1/work-requests/:id/main-history` | Main route/handoff history only. |
| GET | `/api/v1/work-requests/:id/internal-history` | Authorized internal execution/revision history. |
| POST | `/api/v1/work-requests/:id/client-submissions` | Originating final-review gateway submits immutable C1 package. |
| POST | `/api/v1/work-requests/:id/client-submissions/:submissionId/decision` | Authorized ClientContact accepts, rejects, or requests revision. |
| POST | `/api/v1/work-requests/:id/reconsideration` | Exact Responsible Originating Division Lead's single reconsideration request. |
| POST | `/api/v1/work-requests/:id/reconsideration/decision` | Authorized ClientContact accepts or denies that request. |

Create body: `{ bidId XOR projectId, title, priority, notes?, originatingDivisionId, intermediateDivisionIds: UUID[1..], files?, documentCodeIds? }`. `originatingDivisionId` must be active. Normal creators must lead it; the server binds their exact active DivisionLead responsibility. A `tenant_super_admin` without a Member context must additionally supply `responsibleOriginatingDivisionLeadId`, an active Lead of that originating Division, so the route never guesses a responsible Lead. This field is rejected for ordinary creators. Clients cannot send any other responsibility ID, derived tail, route version/step/cycle IDs, Team/Member sequences, state, actor, tenant, storage/version/revision fields, formal revision round, or reconsideration state. `intermediateDivisionIds` preserves order and permits duplicate IDs.

Sequence bodies contain only ordered target UUIDs and optional note. Amendment contains a base route version plus a complete replacement of **remaining future intermediate occurrences**; the service derives immutable tail steps and rejects completed/current modifications. Revision contains classification, exact valid source target, reason/note, and no caller-controlled requester/resume/formal-round field. Initial communication contains `recipientActorIds: UUID[1..]`, nonblank message, and exact owned document-version IDs; reply contains message/attachment IDs only.

Responses are safe projections: IDs, occurrence/cycle/sequence positions, derived progress, permitted actions, safe person labels, exact immutable document-version IDs, timestamps, and immutable event references. They never expose tenant internals, storage keys, authorization internals, or private conversations of another pair. Standard errors: 400 malformed/server-owned fields; 403 permission/scope/exact-responsibility failure; 404 inaccessible resource/target; 409 stale route version, invalid current position, frozen Team sequence, duplicate/idempotent command, concurrent append, invalid revision resume, or exhausted reconsideration. Each route reuses a semantically correct existing generic permission where possible; only a catalogue audit may authorize the smallest required new generic permission, never by a speculative route-specific name.

## HISTORICAL / PRE-ROUTE API

All routes inherit Module 00 response envelopes (`success`, `message`, `data`, metadata/request ID), UUID validation, AppException mapping, pagination, Swagger decorators, and the AccessToken → TenantContext → Authentication → ObjectScope → Permissions guard chain. Controllers return plain data and do not query or construct envelopes.

| Method | Path | Contract |
|---|---|---|
| POST | `/api/v1/work-requests` | Create (multipart), 201 |
| GET | `/api/v1/work-requests` | Paginated scoped list |
| GET | `/api/v1/work-requests/:id` | Scoped detail |
| PATCH | `/api/v1/work-requests/:id` | Allowed metadata only |
| POST | `/:id/assignments/division` | Assign/reassign Division |
| POST | `/:id/assignments/team` | Assign/reassign Team |
| POST | `/:id/assignments/member` | Assign/reassign Member |
| POST | `/:id/submit` | Submit work |
| POST | `/:id/actions` | Configured review/workflow action |
| POST | `/:id/info-requests` | Request clarification |
| POST | `/:id/info-requests/:infoRequestId/respond` | Respond to clarification |
| GET | `/:id/assignments` | Assignment history/current responsibility |
| POST | `/:id/assignments/reviewer` | Assign/reassign `CHECKING`, `APPROVAL`, or `FINAL_REVIEW` |
| GET | `/:id/events` | Paginated audit/event history |
| GET | `/:id/documents` | Scoped Work Request document list |
| GET | `/:id/documents/:documentId/versions` | Scoped immutable document-version history, oldest to newest |
| GET | `/:id/available-actions` | Backend-derived allowed actions |
| POST | `/:id/client-submissions` | Compose and submit immutable package from FINAL_RELEASE |
| GET | `/:id/client-submissions` | Permitted submission history/package metadata |
| POST | `/:id/client-submissions/:submissionId/decision` | Linked external ClientContact accepts, rejects, or requests revision |
| POST | `/:id/client-revision-route` | EXTERNAL_REVIEW routes client revision to an active generic responsibility |

## Create

`POST` consumes `multipart/form-data` with flat fields: required UUID `bidId` XOR `projectId`, trimmed nonblank `title` (maximum bound follows current title convention), required text `priority`, optional trimmed `notes`, optional repeated UUID `documentCodeIds`, and optional `files[]` under current count/size/MIME policy. `priority` is exactly one of `Low`, `Medium`, or `High`; it is a normal multipart text field and is case-sensitive. Files and code IDs are both absent for no-file creation; when code IDs exist, their count equals files and indexes map. Repeated code IDs are valid. **OWNER DECISION REQUIRED:** whether files without code IDs are permitted as uncategorized files.

Example fields: `{ "title": "Prepare Stowage Plan", "priority": "High" }` plus exactly one parent ID. A priority outside `Low | Medium | High` (including `LOW`, `HIGH`, `Urgent`, `Critical`, `Normal`, `low`, or `high`) returns 400.

Reject both/neither parent, category/categoryId, type, attachment category, source channel, all assignment/routing/state/revision fields, parent type, tenant/actor/timestamps, storage/generated filename fields, and unknown input. Response contains safe request summary: id, parent summary, title, priority (`Low`, `Medium`, or `High`), notes, creator summary, derived state, current responsibility summaries, safe document metadata/count, and timestamps.

## Reads, filters, and updates

List extends current `PaginationQueryDto`; supported filters are one parent (`bidId` or `projectId`), exact priority (`Low`, `Medium`, or `High`), derived workflow state, current assigned Division/Team/Member, and current responsibility. No category filters. Detail includes derived state, parent/priority, current and historic assignments, safe file summary, and `availableActions` or its dedicated resource.

`GET /api/v1/work-requests/:id/assignments` preserves every assignment-history field and its
chronological order. For `MEMBER`, `CHECKING`, `APPROVAL`, and `FINAL_REVIEW` rows, it additionally
returns `assignee: { id, label }`, projected only from the target Member's ID and display name.
Division and Team rows return `assignee: null`. This display projection neither changes scope nor
authorization and never exposes Member email, User data, designation, organization, or access state.

PATCH permits only explicitly approved mutable metadata (title and notes); it never changes parent, priority, assignment, state, actor, tenant, files, or audit history. Changes subject to current workflow state are rejected with 409.

## Workflow commands

Division body is `{ divisionId, note? }`; Team is `{ teamId, note? }`; Member is `{ memberId, note? }`; reviewer is `{ memberId, level: CHECKING|APPROVAL|FINAL_REVIEW, note? }`. Generic responsibility assignment validates active same-company membership and required effective capabilities, not business title or organization leadership. Assignment responses return the new history row and derived request state/responsibility.

**Initial-routing tenant-super-admin exception:** a system-defined `tenant_super_admin` may
perform only the Division, Team, and Member routing commands without an ActorProfile Member
link. The actor still requires the exact compatible explicit routing permission; trusted
same-tenant context; a visible Work Request; valid routing state and predecessor assignment;
and an active same-tenant target in the Work Request parent Company. This is not a general
super-admin bypass. It does not apply to submit, checking/approval/final-review decisions or
revision, information, client, or external-review actions; those retain their normal exact
responsibility and relationship requirements.

`POST /:id/actions` accepts configured `actionId` (or stable action code only if the current catalog contract exposes it), optional `note`, and action-specific declared payload. It must not accept arbitrary target status. The contracted actions are the transition-matrix actions: submit, Team/Division Lead/Division Head approval or revision request, and configured post-head handoff. Request/response info accepts a nonblank message plus only a scoped existing target allowed by the configured action; clarification preserves state unless configuration says otherwise.

Phase C1 uses explicit bodies: client submission `{ documentVersionIds: UUID[], note? }`; client decision `{ decision: ACCEPT|REJECT|REQUEST_REVISION, note? }`; client-revision route `{ destination: MEMBER|CHECKING|APPROVAL|FINAL_REVIEW, note? }`. Submission is available only to the assigned EXTERNAL_REVIEW internal member in `FINAL_RELEASE`; decisions are available only to the linked active ClientContact against the latest undecided submitted package in `CLIENT_REVIEW`; routing is available only to assigned EXTERNAL_REVIEW in `CLIENT_REVISION_REQUESTED`. Responses expose safe IDs, round, state, timestamps, note/decision, and submitted version metadata only to authorized callers.

Every route returns 400 for invalid/forbidden fields, 401 for invalid session, 403 for missing grant or object scope, 404 for absent/foreign scoped resources, and 409 for XOR, stale state, invalid transition, inactive/dependent organization record, duplicate/idempotency conflict, or concurrency conflict. Routes use the approved fixed-role baseline and no direct role-name comparisons; every grant remains subject to tenant, ActorProfile, state, scope, organizational relationship, and assignment checks.

## Available actions

## Document history reads

## Phase C2 nested information requests

`POST /:id/info-requests` accepts optional `parentInfoRequestId`, target actor ID, nonblank message, and optional exact Work Request `documentVersionIds[]`. The response route accepts message and optional exact Work Request `documentVersionIds[]`, and closes only its addressed request. History returns a deterministic flat list with nullable parent ID; each request returns requester and target summaries (internal member or external ClientContact), message, status, state at request, immutable attachment-version IDs, timestamps, and nested response summaries. ClientContact callers see only requests where they participate.

External create is permitted only to a ClientContact with an explicitly granted compatible `REQUEST_INFO` role and the exact linked Client/Work Request relationship; no tenant-only access is valid.

`GET /:id/documents` returns safe metadata for documents owned by the scoped Work Request. `GET /:id/documents/:documentId/versions` returns immutable V1 version rows in deterministic oldest-to-newest order (`uploadedAt ASC`, then `id ASC`). Neither route exposes binary content, tenant IDs, or internal storage keys. A document ID belonging to another request is not found.

`GET /:id/available-actions` returns the backend’s safe action descriptors (stable identity, label, optional input requirement/target kind) after evaluating latest derived state, permission, active ActorProfile/role grant, object scope, active assignment, parent relationship, and organization hierarchy. It exposes no client-side authorization matrix and does not authorize callers by role name alone. A false/empty result is correct when any one predicate fails.

## C3 parent/cycle compatibility

No C3 endpoint changes this Work Request API. When creating a Bid-owned request, the server (not the client) records the parent Bid's current business-cycle membership; when creating a DirectProject-owned request it records no Bid cycle. No request may carry both parents or become Project-owned because its Bid later converts. C3 business-outcome readiness consumes this persisted membership and latest C1 client lifecycle records only; it does not alter routing, available actions, C1, or C2 contracts.

# API Contract: 10 — Work Requests

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

PATCH permits only explicitly approved mutable metadata (title and notes); it never changes parent, priority, assignment, state, actor, tenant, files, or audit history. Changes subject to current workflow state are rejected with 409.

## Workflow commands

Division body is `{ divisionId, note? }`; Team is `{ teamId, note? }`; Member is `{ memberId, note? }`; reviewer is `{ memberId, level: CHECKING|APPROVAL|FINAL_REVIEW, note? }`. Generic responsibility assignment validates active same-company membership and required effective capabilities, not business title or organization leadership. Assignment responses return the new history row and derived request state/responsibility.

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

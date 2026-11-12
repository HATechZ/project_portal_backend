# API Contract: 10 — Route-Based Work Requests

> **AUTHORITATIVE API:** This contract governs new route-based Work Requests. The retained compatibility surface remains supported where explicitly stated; Request Information is supported for both route-based and compatibility Work Requests. All routes inherit Module 00 envelope, error mapping, UUID validation, `x-request-id`, pagination, and guard conventions.

## Route-based surface

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/work-requests` | Create a route-based request with ordered intermediate Division IDs; server derives origin-final and Client tail. |
| POST | `/api/v1/work-requests/:id/archive` | Archive the scoped Work Request without deleting or changing its workflow/history. |
| POST | `/api/v1/work-requests/:id/restore` | Restore the scoped archived Work Request to its preserved active execution state. |
| GET | `/api/v1/work-requests/:id/route` | Main route/progress projection. |
| POST | `/api/v1/work-requests/:id/route-amendments` | Exact Responsible Originating Division Lead appends a versioned amendment to remaining future route steps. |
| GET | `/api/v1/work-requests/:id/internal-cycles/:cycleId` | Authorized Division/Team/Member execution projection. |
| POST | `/api/v1/work-requests/:id/division-cycles/:cycleId/team-sequence` | Define the active Division cycle's fixed ordered Team sequence. |
| POST | `/api/v1/work-requests/:id/team-steps/:teamStepId/member-sequence` | Define the active Team's ordered Member sequence. |
| POST | `/api/v1/work-requests/:id/team-steps/:teamStepId/member-steps` | Append a future Member step to the active Team sequence. |
| POST | `/api/v1/work-requests/:id/member-steps/:memberStepId/submit` | Submit current Member work. JSON body is optional: `{ message?: string, documentVersionIds?: UUID[] }`; IDs reference existing owned Work Request DocumentVersions only (no files/multipart). |
| POST | `/api/v1/work-requests/:id/team-steps/:teamStepId/complete` | Complete current Team work. |
| POST | `/api/v1/work-requests/:id/route-steps/:routeStepId/forward` | Normal forward only to the next approved route occurrence. |
| POST | `/api/v1/work-requests/:id/revisions` | Request internal Member, internal Team, or cross-Division formal revision. |
| POST | `/api/v1/work-requests/:id/revisions/:revisionId/resubmit` | Source correction returns directly to preserved requester/resume destination. JSON body is optional: `{ note?: string, documentVersionIds?: UUID[] }`; IDs reference existing owned Work Request DocumentVersions only. |
| GET | `/api/v1/work-requests/:id/communication-recipients` | Context-valid exact people available to the caller. |
| POST | `/api/v1/work-requests/:id/conversations/messages` | Fan out one initial message to one or more exact recipients. |
| GET | `/api/v1/work-requests/:id/conversations/:conversationId` | Pair-only continuous conversation history. |
| POST | `/api/v1/work-requests/:id/conversations/:conversationId/messages` | Append a pair-conversation message. |
| GET | `/api/v1/work-requests/:id/main-history` | Main route/handoff history only. |
| GET | `/api/v1/work-requests/:id/internal-history` | Authorized internal execution/revision history. |
| GET | `/api/v1/work-requests/:id/info-requests/recipients` | Backend-derived Request Information recipients. |
| GET | `/api/v1/work-requests/:id/info-requests/recipients/status` | Active ClientContact and usable default-profile counts for recipient availability. |
| POST | `/api/v1/work-requests/:id/info-requests` | Create a Request Information record with owned Work Request document-version attachments. |
| POST | `/api/v1/work-requests/:id/info-requests/:infoRequestId/respond` | Addressed recipient response with owned document-version attachments. |
| GET | `/api/v1/work-requests/:id/info-requests` | Visible Request Information history. |
| POST | `/api/v1/work-requests/:id/client-submissions` | Originating final-review gateway submits immutable C1 package. |
| POST | `/api/v1/work-requests/:id/client-submissions/:submissionId/decision` | Authorized ClientContact accepts, rejects, or requests revision. |
| POST | `/api/v1/work-requests/:id/reconsideration` | Exact Responsible Originating Division Lead's single reconsideration request. |
| POST | `/api/v1/work-requests/:id/reconsideration/decision` | Authorized ClientContact accepts or denies that request. |
| GET | `/api/v1/work-requests/:id/documents/available-document-codes` | Active, upload-applicable Document Codes for the current execution Division; requires `UPLOAD_DOCUMENT`, scoped resource access, and does not require `VIEW_DOCUMENT_CODES`. |
| GET | `/api/v1/work-requests/creation/available-document-codes?originatingDivisionId=<uuid>` | Active `GENERAL` plus the supplied active originating Division's configured groups; exactly the create-time Document Code applicability input; requires `CREATE_WORK_REQUEST`, not `VIEW_DOCUMENT_CODES`. |

Create body: `{ bidId XOR projectId, title, priority, notes?, originatingDivisionId, responsibleOriginatingDivisionLeadId?, intermediateDivisionIds: UUID[1..], files?, documentCodeIds? }`. The creator requires explicit compatible `CREATE_WORK_REQUEST`, an active internal ActorProfile, and same-Company access to the selected parent; a prior Work Request relationship is never required. `originatingDivisionId` must be active. When `responsibleOriginatingDivisionLeadId` is omitted, the creator must be that active Lead; an authorized business creator who is not the originating Lead supplies the exact active Lead of that originating Division. The server validates that relationship and never derives it from a role name. A creator without a Member context must supply it. Clients cannot send any other responsibility ID, derived tail, route version/step/cycle IDs, Team/Member sequences, state, actor, tenant, storage/version/revision fields, formal revision round, or reconsideration state. `intermediateDivisionIds` preserves order and permits duplicate IDs.

Route steps expose `divisionId` and `divisionName` from the Division relation (both null for the Client step). The route projection exposes the persisted `divisionCycleId`, `teamStepId`, and `memberStepId`, each nullable when no corresponding execution step is active.

Sequence bodies contain only ordered target UUIDs and optional note. Amendment contains a base route version plus a complete replacement of **remaining future intermediate occurrences**; the service derives immutable tail steps and rejects completed/current modifications. Revision contains classification, exact valid source target, reason/note, and no caller-controlled requester/resume/formal-round field. Initial communication contains `recipientActorIds: UUID[1..]`, nonblank message, and exact owned document-version IDs; reply contains message/attachment IDs only.

Responses are safe projections: IDs, occurrence/cycle/sequence positions, derived progress, permitted actions, safe person labels, exact immutable document-version IDs, timestamps, and immutable event references. They never expose tenant internals, storage keys, authorization internals, or private conversations of another pair. Standard errors: 400 malformed/server-owned fields; 403 permission/scope/exact-responsibility failure; 404 inaccessible resource/target; 409 stale route version, invalid current position, frozen Team sequence, duplicate/idempotent command, concurrent append, invalid revision resume, or exhausted reconsideration. Each route reuses a semantically correct existing generic permission where possible; only a catalogue audit may authorize the smallest required new generic permission, never by a speculative route-specific name.

## Document Code applicability

Document Code administration is distinct from upload use. Bid and Project uploads accept only
active tenant `GENERAL` or `MARKETING` codes. A Work Request selector/upload resolves the active
route projection's Division-bearing route step (including a revision branch); historical V1 uses
its one active Division assignment. It returns/accepts active same-tenant `GENERAL` codes plus
that Division's explicitly configured non-GENERAL groups. No current Division, or multiple
historical active Division assignments, is a 409 rather than a guessed fallback. `ETC` and
`CUSTOM` are never global but may be returned for a Work Request only if explicitly configured.

## Compatibility API

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
| GET | `/:id/info-requests/recipients` | Backend-derived eligible clarification recipients |
| POST | `/:id/info-requests/:infoRequestId/respond` | Respond to clarification |
| GET | `/:id/assignments` | Assignment history/current responsibility |
| POST | `/:id/assignments/reviewer` | Assign/reassign `CHECKING`, `APPROVAL`, or `FINAL_REVIEW` |
| GET | `/:id/events` | Paginated audit/event history |
| GET | `/:id/documents` | Scoped Work Request document list |
| GET | `/:id/documents/:documentId/versions` | Scoped immutable document-version history, oldest to newest |
| POST | `/:id/documents/download` | Download selected or all owned document versions as one authenticated ZIP |
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

List extends current `PaginationQueryDto`; supported filters are one parent (`bidId` or `projectId`), exact priority (`Low`, `Medium`, or `High`), derived workflow state, current assigned Division/Team/Member, current responsibility, and additive `lifecycle=active|archived|all`. The default is `active`, preserving normal operational-list behavior for existing callers; `archived` and `all` remain subject to the existing scoped visibility predicate. This filter does not change the existing list response shape. No category filters. Detail includes derived state, parent/priority, current and historic assignments, safe file summary, and `availableActions` or its dedicated resource.

`GET /api/v1/work-requests/:id/assignments` preserves every assignment-history field and its
chronological order. For `MEMBER`, `CHECKING`, `APPROVAL`, and `FINAL_REVIEW` rows, it additionally
returns `assignee: { id, label }`, projected only from the target Member's ID and display name.
Division and Team rows return `assignee: null`. This display projection neither changes scope nor
authorization and never exposes Member email, User data, designation, organization, or access state.

PATCH permits only explicitly approved mutable metadata (title and notes); it never changes parent, priority, assignment, state, actor, tenant, files, or audit history. Changes subject to current workflow state are rejected with 409.

## Archive and restore

`POST /api/v1/work-requests/:id/archive` accepts JSON `{ reason?: string }`; a supplied reason is trimmed and bounded by the current note/comment policy. `POST /api/v1/work-requests/:id/restore` has an empty body. Both use the existing standard response envelope and return a small lifecycle confirmation only: `{ id, lifecycle: { status: 'active' | 'archived', archivedAt: string | null, archivedByActorId: string | null, reason: string | null } }`. They do not return or reshape the normal route, Internal Workflow, document, or list payloads. `DELETE /api/v1/work-requests/:id` is not supported.

Archive requires `ARCHIVE_WORK_REQUEST`; restore requires `RESTORE_WORK_REQUEST`. Both additionally require active ActorProfile/role, same-tenant compatible scope, existing Work Request resource visibility/relationship, and lifecycle validity; no hardcoded custom role name authorizes either command. A repeated archive of an archived request and a restore of an active request return 409. Missing/inaccessible/cross-tenant resources remain 404; missing permission or scope is 403. Archive is permitted for an in-progress request but atomically freezes execution without changing its derived workflow state, route position, current responsibility, or any stored workflow fact. Restore atomically unfreezes that same preserved state.

While archived, all ordinary mutating Work Request commands return 409 before changing data: metadata update; route amendment/forward; Team or Member sequence definition; Member append/submit; Team completion; revision request/resubmit; Request Info creation/reply; communication send/reply; document upload/versioning; client submission, decision, reconsideration, and other workflow mutations. Existing authorized read-only detail, list when explicitly requested, route/history, Internal Workflow projection, documents/versions/preview/download, revision history, Request Info history, conversations, and audit reads remain available without widening visibility. `available-actions` is unchanged in shape and returns no normal execution actions while archived.

## Workflow commands

Division body is `{ divisionId, note? }`; Team is `{ teamId, note? }`; Member is `{ memberId, note? }`; reviewer is `{ memberId, level: CHECKING|APPROVAL|FINAL_REVIEW, note? }`. A Division assignment requires `ASSIGN_WORK_REQUEST_DIVISION`, valid assignment state, an active same-Tenant/Company Division, and that Division's one active Lead with an active default ActorProfile. The write, event, and outbox record are atomic; a Lead-less Division returns 409 before any assignment is written. The response projects its resolved responsible recipient(s); the active Division Lead is a current Work Request participant without manufacturing a `MEMBER` assignment. Generic responsibility assignment validates active same-company membership and required effective capabilities, not business title or organization leadership.

**Initial-routing tenant-super-admin exception:** a system-defined `tenant_super_admin` may
perform only the Division, Team, and Member routing commands without an ActorProfile Member
link. The actor still requires the exact compatible explicit routing permission; trusted
same-tenant context; a visible Work Request; valid routing state and predecessor assignment;
and an active same-tenant target in the Work Request parent Company. This is not a general
super-admin bypass. It does not apply to submit, checking/approval/final-review decisions or
revision, information, client, or external-review actions; those retain their normal exact
responsibility and relationship requirements.

`POST /:id/actions` accepts configured `actionId` (or stable action code only if the current catalog contract exposes it), optional `note`, and action-specific declared payload. It must not accept arbitrary target status. The contracted actions are the transition-matrix actions: submit, Team/Division Lead/Division Head approval or revision request, and configured post-head handoff. Request/response info requires a nonblank message or at least one owned document attachment and retains the scoped target rule; clarification preserves state unless configuration says otherwise.

Phase C1 uses explicit bodies: client submission `{ documentVersionIds: UUID[], note? }`; client decision `{ decision: ACCEPT|REJECT|REQUEST_REVISION, note? }`; client-revision route `{ destination: MEMBER|CHECKING|APPROVAL|FINAL_REVIEW, note? }`. Submission is available only to the assigned EXTERNAL_REVIEW internal member in `FINAL_RELEASE`; decisions are available only to the linked active ClientContact against the latest undecided submitted package in `CLIENT_REVIEW`; routing is available only to assigned EXTERNAL_REVIEW in `CLIENT_REVISION_REQUESTED`. Responses expose safe IDs, round, state, timestamps, note/decision, and submitted version metadata only to authorized callers.

Every route returns 400 for invalid/forbidden fields, 401 for invalid session, 403 for missing grant or object scope, 404 for absent/foreign scoped resources, and 409 for XOR, stale state, invalid transition, inactive/dependent organization record, duplicate/idempotency conflict, or concurrency conflict. Routes use the approved fixed-role baseline and no direct role-name comparisons; every grant remains subject to tenant, ActorProfile, state, scope, organizational relationship, and assignment checks.

## Available actions

## Document history reads

## Request Information

`GET /:id/info-requests/recipients` requires `REQUEST_INFO` and returns the only target ActorProfile IDs accepted by `POST /:id/info-requests`. The backend derives the caller's live route-execution context: the exact responsible originating Lead may select usable linked ClientContacts and active same-Company Division Leads; another active Lead of the current Division may select its current Division's Team Leads and other active Division Leads; a current Team Lead may select own-Division Leads, Members of its Work Request-relevant Teams, and other current Team Leads in that Division; and a current Member may select only its Work Request-relevant Team Lead and Team Members. The caller is excluded. A persisted same-tenant Request Info pair additionally permits only the exact reciprocal counterpart for that Work Request; it never grants unrelated recipient access. Client Contacts require a usable active default portal ActorProfile. `POST` recomputes this policy rather than trusting frontend discovery. The response route requires exact addressed-target identity and an open request; it does not require a broad response grant that could block a valid recipient. `POST /:id/info-requests` accepts optional `parentInfoRequestId`, target actor ID, optional message, and optional exact Work Request `documentVersionIds[]`. A nonblank message or at least one attachment is required for both request and response; an attachment-only message is stored as an empty string. Files are uploaded through the existing authenticated Work Request document endpoint first; any number of the returned immutable version IDs may then be attached, only when they belong to this exact Tenant and Work Request. History returns a deterministic flat list with nullable parent ID; each request returns requester and target summaries (internal member or external ClientContact), message, status, state at request, immutable attachment-version IDs, timestamps, and nested response summaries. ClientContact callers see only requests where they participate.

Recipient descriptors include display name, Client or Division Lead context, `canReceive`, and `canRespond`; response permission is not required for selection. The separate `recipients/status` endpoint requires the same permission and Work Request access and returns `activeContacts`, `contactsWithActiveDefaultProfile`, and unavailable contact descriptors explaining missing usable profiles; counts do not assert that portal access was explicitly enabled. Division assignment history includes current active `responsibleRecipients` only for active Division rows; historical rows do not claim current leadership as historical responsibility.

Internal history and information-request read endpoints also permit an active, explicitly permitted actor with company or tenant-wide internal Work Request visibility, after a tenant-scoped resource visibility check. This read access does not grant authority to create or respond to information requests or perform workflow actions; those retain their relationship requirements.

An active ActorProfile with a persisted requester or target relationship may read its own Request Info records for the same Tenant and Work Request without `VIEW_WORK_REQUEST`, even after route responsibility changes. Participant results include only records involving that ActorProfile. An active ActorProfile with explicit `REQUEST_INFO` and one or more backend-derived eligible recipients may also open history before its first Request Info row; it receives an empty list, never another actor's records. The separately authorized administrative read requires `VIEW_WORK_REQUEST` and scoped Work Request visibility and grants no communication rights.

External create is permitted only to a ClientContact with an explicitly granted compatible `REQUEST_INFO` role and the exact linked Client/Work Request relationship; no tenant-only access is valid.

`GET /:id/documents` returns safe metadata for documents owned by the scoped Work Request. `GET /:id/documents/:documentId/versions` returns immutable V1 version rows in deterministic oldest-to-newest order (`uploadedAt ASC`, then `id ASC`). Every returned version exposes `documentId`, `versionId`, `mimeType`, `originalFileName` (on the logical document), `downloadUrl`, and a nullable `previewUrl`. These are authenticated relative endpoints: `GET /api/v1/document-versions/:versionId/download` streams the exact visible version as an attachment, while `GET /api/v1/document-versions/:versionId/preview` streams only PDF/image versions inline. Neither route exposes binary content, tenant IDs, or internal storage keys. A document ID belonging to another request is not found.

`POST /:id/documents/download` accepts `{ documentVersionIds?: UUID[] }`; omitted or `[]` means every version owned by the visible Work Request, otherwise every requested ID must belong to that exact Work Request. It returns one `application/zip` attachment, never a partial archive. It requires `VIEW_DOCUMENT`, an active compatible ActorProfile, same-tenant scoped Work Request visibility, and successful storage reads. Duplicate logical filenames are disambiguated within the archive.

`GET /:id/available-actions` returns the backend’s safe action descriptors (stable identity, label, optional input requirement/target kind) after evaluating latest derived state, permission, active ActorProfile/role grant, object scope, active assignment, parent relationship, and organization hierarchy. It exposes no client-side authorization matrix and does not authorize callers by role name alone. A false/empty result is correct when any one predicate fails.

## C3 parent/cycle compatibility

No C3 endpoint changes this Work Request API. When creating a Bid-owned request, the server (not the client) records the parent Bid's current business-cycle membership; when creating a DirectProject-owned request it records no Bid cycle. No request may carry both parents or become Project-owned because its Bid later converts. C3 business-outcome readiness consumes this persisted membership and latest C1 client lifecycle records only; it does not alter routing, available actions, C1, or C2 contracts.

Request Info recipient descriptors additionally expose nullable `memberId`, `email`, `divisionId`, `divisionName`, `designationId`, and `designationName`, plus aligned `teamIds` and `teamNames` arrays and current `relationshipContexts`. Teams include active memberships and active led Teams, deduplicated by ID. Internal designation and Division come from the current Member relations; Client Contacts have null internal fields and empty Team arrays. Existing recipient context fields and eligibility remain unchanged.

## Additive Internal Division Workflow contract

The Internal Division Workflow is a separate, derived Division-cycle projection; it neither replaces nor changes the Main Workflow route contract. Future implementation exposes it only as additive data on the authorized existing `GET /api/v1/work-requests/:id/internal-cycles/:cycleId` projection (or an equivalent additive, separately authorized read), never by removing, reshaping, or repurposing `GET /api/v1/work-requests/:id/route`.

For an active or historical Division cycle whose authoritative Team sequence is `Team A -> Team B -> Team C`, the projection is `Division -> Team A -> Team B -> Team C -> Division`. The caller never creates these Division boundary nodes and no Internal Workflow create/update command, modal, or second Team sequence exists. Saving the existing ordered Team sequence derives the projection in the same background business flow; a later valid change to the authoritative Team sequence is reflected by the derived projection.

Conceptual additive response data is:

```ts
internalWorkflow: {
  divisionId: string;
  divisionName: string;
  divisionCycleId: string;
  steps: Array<
    | { kind: 'division-start'; state: 'completed' | 'current' | 'upcoming'; }
    | {
        kind: 'team'; teamStepId: string; teamId: string; teamName: string;
        ordinal: number; state: 'completed' | 'current' | 'upcoming';
      }
    | { kind: 'division-end'; state: 'completed' | 'current' | 'upcoming'; }
  >;
  currentTeamStepId?: string | null;
} | null
```

The projection contains top-level Team nodes only. Member steps remain nested execution of their Team and are not flattened into this Division-level sequence. Node state is derived from existing Division-cycle and Team-step responsibility facts, not stored or driven by a second execution engine: before Team work the start boundary is current; while Team A is active, start is completed and Team A is current; after Team A completes Team B becomes current; after the final Team completes, every Team is completed and the end boundary is current.

Read authorization remains backend-enforced: explicit permission + tenant + compatible scope + Work Request relationship + assignment/responsibility + workflow state. A Division-level responsible actor may receive the unchanged Main Workflow route and its own Internal Division Workflow. A Team Lead or Member receives only the authorized Internal Division Workflow and must not receive Main Workflow route occurrences, cross-Division progress, or Client-stage data. An unrelated Division actor and every cross-tenant actor receive neither the Internal Workflow nor its inferred labels/counts/state. No hardcoded organizational role name authorizes this data; only `tenant_super_admin` remains system-defined.

The additive internal-cycle response also exposes backend-derived presentation metadata:

```ts
workflowVisibility: {
  canViewMainWorkflow: boolean;
  canViewInternalWorkflow: boolean;
}
```

For a same-tenant, resource-authorized `tenant_super_admin`, both flags are `true`. This
metadata describes a visibility decision already authorized by the backend; it does not grant
access, bypass tenant/Work Request/resource checks, or turn `tenant_super_admin` into a global
business-relationship wildcard. If more than one Internal Division Workflow is legitimately
available for the same Work Request and tenant, future additive discovery/read support may expose
each available projection; the contract must not artificially restrict `tenant_super_admin` to one
unrelated fixed Division, and must not change the Main Workflow contract.

**Main Workflow backward compatibility (non-regression):** this feature must not require a change to existing Main Workflow endpoint/data, route occurrences, lifecycle, Division forward logic, route progression, Client stage, or the Division Lead Main Workflow presentation. The existing main-route response remains the source for the Main Workflow and is not appended with Internal Workflow execution semantics.

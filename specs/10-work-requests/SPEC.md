# SPEC: 10 — Route-Based Work Requests

**Status:** authoritative redesign contract; implementation of this model has not started. **Runtime target:** `src/work-request/**`. **API base:** `/api/v1/work-requests`.

> **AUTHORITATIVE ROUTE MODEL:** The route-based contracts in this directory supersede the pre-route linear workflow text below for all newly created compatible Work Requests. The retained text is **HISTORICAL / PRE-ROUTE MODEL**, useful only to preserve existing V1 records and APIs through the documented cutover. It must not be used to authorize or implement new route-based behavior.

> **AUTHORIZATION:** `permission + compatible scope + active same-Tenant actor + exact Work Request/resource relationship + exact responsibility + valid workflow context = ALLOW`. User is login/security identity; Member is internal business person; ActorProfile is acting context. No Division/Team name, company-specific identity, role name/code, title, or designation is an authorization semantic. `tenant_super_admin` is own-Tenant only and has no workflow-responsibility bypass.

> **RESPONSIBLE ORIGINATING LEAD:** Every route-based Work Request persists its Originating Division and the exact active Division Lead bound as its Responsible Originating Division Lead. Only that bound Lead holds Work Request-specific originating-lead authority: initial route definition, permitted future-route amendment, Originating final review, Client gateway/submission handling, Client revision coordination, and one-time reconsideration request. Another active Lead of the same Division has no such authority merely through Division membership. Transfer is an explicit, auditable Work Request responsibility change; it is never inferred.

> **PERMISSION POLICY:** Reuse an existing generic permission whenever it correctly represents a route-based capability. If the catalogue audit proves that a required capability cannot be represented safely, implementation may add the smallest necessary generic permission with explicit scope compatibility, catalogue provisioning/reconciliation, and authorization tests. A permission alone never authorizes a command; exact resource, responsibility, and workflow context remain required. No speculative new permission name is frozen here.

> **CURRENT AUTHORITY:** [Route & Execution Lifecycle](ROUTE_AND_EXECUTION_LIFECYCLE.md), [Revision & Resume](REVISION_AND_RESUME.md), [Request Info Communication](REQUEST_INFO_COMMUNICATION.md), [Workflow Projections & Visibility](WORKFLOW_PROJECTIONS_VISIBILITY.md), [Client Gateway & Reconsideration](CLIENT_GATEWAY_RECONSIDERATION.md), [Migration Cutover](MIGRATION_CUTOVER.md), and [Test Matrix](TEST_MATRIX.md) govern this module. C1 exact package snapshots and C3 current-cycle readiness remain preserved.

## HISTORICAL / PRE-ROUTE V1 MATERIAL

> **SUPERSEDED ROLE CONTENT:** [`ROLE_ARCHITECTURE_FREEZE.md`](../ROLE_ARCHITECTURE_FREEZE.md) is authoritative. Fixed-role rules, grant matrices, role-name authorization, and legacy custom-scope statements here are retained only as historical implementation context.

> **PERMISSION CATALOGUE:** [`PERMISSION_CATALOGUE_GLOBALIZATION.md`](../PERMISSION_CATALOGUE_GLOBALIZATION.md) governs all legacy Work Request capability labels. Role-labelled states/actions are compatibility labels only.

## Purpose and boundary
Work Request is a tenant-owned operational aggregate initiated against exactly one independent Bid or Project. It owns request creation, routing assignments, workflow event/audit history, request-info clarification, safe Work Request files, and backend-derived available actions. It does not merge Bid and Project, create a workspace/BidProject, own Team membership, or own document-code catalogues.

## Generic responsibility workflow (current)

The current V1 workflow is organization-neutral. `MEMBER` is the preparation responsibility; `CHECKING`, `APPROVAL`, and `FINAL_REVIEW` are independent member assignments. They are not security roles or employee titles. A responsibility is authorized only by compatible granted permission, active same-tenant Member, resource relationship, exact active assignment, and exact state; no role name, designation, Division/Team name, or lead relationship authorizes it.

`MEMBER_ASSIGNED` is the preparation state. The generic route is `MEMBER_ASSIGNED --WR_SUBMIT--> CHECKING_REVIEW --WR_CHECKING_APPROVE--> APPROVAL_REVIEW --WR_APPROVAL_APPROVE--> FINAL_REVIEW --WR_FINAL_RELEASE--> FINAL_RELEASE`. `WR_REQUEST_REVISION` from each review state returns to `MEMBER_ASSIGNED`. It uses `SUBMIT_WORK_REQUEST`, `APPROVE_WORK_REQUEST_REVIEW`, `REQUEST_WORK_REQUEST_REVISION`, and `SUBMIT_FOR_REVIEW` respectively. Historical title-based states/actions remain readable compatibility data and are not emitted by this flow.

Preparation is assigned with `ASSIGN_WORK_REQUEST_MEMBER`; each reviewer responsibility is assigned with `ASSIGN_REVIEWER`. Assignment checks active same-company Member status and mandatory effective capabilities (including document view where package access is required), records temporal replacement history, and permits one active assignment per responsibility. Request/response information is a side workflow: it never changes the main state or restores a prior assignee. Responsibility-driven events retain a nullable responsibility-level snapshot.

**Initial-routing tenant-super-admin exception:** the system-defined `tenant_super_admin` may
execute only Division, Team, and Member initial routing/reassignment without an ActorProfile
Member link, provided it holds the exact compatible explicit routing permission and all
tenant, parent-Company, target, state, predecessor-assignment, visibility, and idempotency
checks pass. This is not a general bypass and does not apply to `WR_SUBMIT`, checking,
approval, final-release, revision, information, client, or external-review actions; those
continue to require their ordinary exact responsibility and relationship checks.

## Phase C1 — client-facing lifecycle

`EXTERNAL_REVIEW` is an internal member responsibility, never a role or department. It is assigned through `ASSIGN_REVIEWER`, one active assignment per request, and requires effective `VIEW_WORK_REQUEST`, `VIEW_DOCUMENT`, `SUBMIT_FOR_EXTERNAL_REVIEW`, and `SUBMIT_CLIENT_REVISION`. No title, organization hierarchy, or role identity authorizes it.

From `FINAL_RELEASE`, the exact EXTERNAL_REVIEW assignee selects one or more eligible V1 document-version IDs and submits an immutable client package with `SUBMIT_FOR_EXTERNAL_REVIEW`, producing `CLIENT_REVIEW`. Every submitted package is a numbered round; its items are immutable exact version references. A later internal version never changes a historical package. After client revision, resubmission uses `SUBMIT_CLIENT_REVISION` and creates a new round.

Only an active external ClientContact linked to the request parent's Client, with the relevant external capability, may decide the latest submitted package: accept (`ACCEPT_FINAL_DELIVERY` → `ACCEPTED`), reject (`REJECT_FINAL_DELIVERY` → `REJECTED`), or request revision (`REQUEST_REVISION` → `CLIENT_REVISION_REQUESTED`). Tenant match alone is insufficient. External reads expose only the approved package snapshot and client-visible decision data, never working documents, assignments, or internal notes.

Client revision routing is internal: the exact EXTERNAL_REVIEW assignee with `ROUTE_FOR_REVIEW` chooses an already-active destination responsibility (`MEMBER`, `CHECKING`, `APPROVAL`, or `FINAL_REVIEW`) and its corresponding generic state. It never creates assignments or routes by department/team/title. Submission, decision, and routing writes are serializable/idempotent, append audit events with submission/decision context, and publish after persistence.

Phase C1 excludes parent completion/business-decision gating, Bid-to-Project conversion, archive/reopen, and nested information requests. Clarification remains unchanged; it is not expanded for client-review states in C1.

The current `work_requests`, generic `documents`, category, attachment-category, project-only parent, mutable assignment columns, and legacy workflow structures are legacy persistence. They are not the V1 structural contract. This spec makes no runtime, Prisma, migration, seed, RLS, grant, or permission change.

## Business rules

- Create input is exactly `bidId` XOR `projectId`, `title`, fixed `priority`, optional `notes`, optional `files[]`, and optional `documentCodeIds[]`. Tenant, actor, timestamps, initial event, routing, status, and all ownership derive server-side.
- The selected same-tenant parent must exist, be readable by the actor through the parent’s object scope, and be in a configured state that allows request creation. Bid and Project remain separate domains and must never be represented by `parentType + parentId`.
- `priority` is fixed Work Request data sent directly by the frontend. It accepts exactly `Low`, `Medium`, or `High`; case is not normalized and every other value is rejected.
- Category, categoryId, workRequestType, attachmentCategory, sourceChannel, origin/assigned Division/Team/Member, currentStatus, workflow stage, revision, tenant, and actor fields are forbidden create input.
- Creation appends `WORK_REQUEST_CREATED` with resulting state `CREATED`; it does not assign a Division, Team, or Member.
- Routing is Division Head → eligible Division; Division Lead → eligible Team in that Division; Team Lead → eligible active Team Member. Team membership remains separate and is never modified by Work Request assignment.
- Assignments are temporal history. A replacement closes the prior current assignment at that level and creates a successor; current responsibility is derived from active assignment rows, never mutable root `assigned*` fields.
- Workflow state is derived deterministically from the latest append-only Work Request event/audit row, ordered by occurred time then ID. A projection is permitted only as a consistent performance cache.
- Request Info / Respond Info is a clarification exchange. It preserves the main workflow state unless the configured workflow explicitly defines a state-changing transition.
- Initial files are optional. When classified files are supplied, `files[i]` maps to `documentCodeIds[i]`; generic `documentCodeId` identity is used and code-management modules stay independent. Original filename, generated filename, storage key, metadata, and historical classification behavior follow current Bid/Project document architecture. Documents retain immutable version rows; later revision/resubmission writes create a new version and never overwrite history.

## Workflow and authorization

## 2026-10-07 visibility and neutral responsibility addendum

Use one Work Request predicate for list, detail, assignment/info history, and related documents:
Company scope sees Company requests; Division scope requires an active Division assignment for a
Division actively led by the actor; Team scope requires an active Team assignment whose Team has
the actor as `leadMemberId`; Member scope requires the exact active Member assignment. No
same-Tenant fallback exists.

Division routing is Company-scope authority plus state; Team routing requires the active assigned
Division's `DivisionLead`; Member routing requires the active assigned Team's `leadMemberId`.
Submission requires the exact active assigned Member. Team review/revision requires that active
Team's lead; Division review/revision requires that active Division's lead. `REQUEST_INFO` requires
valid request visibility/responsibility, active non-terminal state, and the existing valid target;
response requires valid target, open request, and resource relationship. Permissions are necessary
but these business assignments, never role names, prove responsibility.

## Workflow and authorization

The hierarchy describes routing authority, not hard-coded role checks. Every command requires authenticated User, trusted TenantContext, eligible active ActorProfile/role grant, configured action permission, object scope, request/parent/organization relationship, and valid current workflow state. The backend computes `availableActions`; clients must not reconstruct this matrix.

`CREATED` is the canonical initial state. The minimal configured state sequence is `CREATED` → `DIVISION_ASSIGNED` → `TEAM_ASSIGNED` → `MEMBER_ASSIGNED` → `MEMBER_SUBMITTED` → `TEAM_LEAD_APPROVED` → `DIVISION_LEAD_APPROVED` → `DIVISION_HEAD_APPROVED`. These are states, not actions or audit-event names. `WORK_REQUEST_CREATED`, assignments, submissions, approvals, revision requests, resubmissions, reassignment, request-info, and respond-info are events/actions. `REVISION_REQUESTED` is an audit/action record that returns the request to the appropriate responsible state; it is not an ambiguous replacement for that state. No generic `REJECTED`/`RETURNED` terminal state is introduced: a reviewer’s non-terminal return is the explicit revision path, and any terminal rejection requires a separately configured terminal transition.

The current action catalogue supplies `ADD_WORK_REQUEST`, `ADD_WORK_REQUEST_DOCUMENT`, `ADD_WORK_REQUEST_NOTE`, `REQUEST_WORKFLOW_INFO`, `RESPOND_WORKFLOW_INFO`, and `ASSIGN_MEMBER`; only the first five are Work Request capabilities. Approved new catalogue codes are `VIEW_WORK_REQUEST`, `UPDATE_WORK_REQUEST`, `WR_ASSIGN_DIVISION`, `WR_ASSIGN_TEAM`, `WR_ASSIGN_MEMBER`, `WR_SUBMIT`, `WR_TEAM_LEAD_APPROVE`, `WR_TEAM_LEAD_REQUEST_REVISION`, `WR_DIVISION_LEAD_APPROVE`, `WR_DIVISION_LEAD_REQUEST_REVISION`, `WR_DIVISION_HEAD_APPROVE`, and `WR_DIVISION_HEAD_REQUEST_REVISION`. Authorization is never inferred from role names.

### HISTORICAL / PRE-ROUTE fixed-role permission baseline

The canonical fixed system-role code is `tenant_super_admin`. It is not an authorization bypass. The following baseline grants are only the Work Request permissions; every command additionally requires authenticated tenant context, an active ActorProfile and role assignment, the permission, current Work Request state, object scope, organization relationship, and an active Work Request assignment where the transition requires one.

| Fixed role | Work Request permission baseline |
|---|---|
| tenant_super_admin | `ADD_WORK_REQUEST`, `ADD_WORK_REQUEST_DOCUMENT`, `ADD_WORK_REQUEST_NOTE`, `REQUEST_WORKFLOW_INFO`, `RESPOND_WORKFLOW_INFO`, `VIEW_WORK_REQUEST`, `UPDATE_WORK_REQUEST` |
| ccr_coordinator | `ADD_WORK_REQUEST`, `ADD_WORK_REQUEST_DOCUMENT`, `ADD_WORK_REQUEST_NOTE`, `REQUEST_WORKFLOW_INFO`, `RESPOND_WORKFLOW_INFO`, `VIEW_WORK_REQUEST` |
| division_head | `VIEW_WORK_REQUEST`, `REQUEST_WORKFLOW_INFO`, `RESPOND_WORKFLOW_INFO`, `WR_ASSIGN_DIVISION`, `WR_DIVISION_HEAD_APPROVE`, `WR_DIVISION_HEAD_REQUEST_REVISION` |
| division_lead | `ADD_WORK_REQUEST_DOCUMENT`, `ADD_WORK_REQUEST_NOTE`, `REQUEST_WORKFLOW_INFO`, `RESPOND_WORKFLOW_INFO`, `VIEW_WORK_REQUEST`, `WR_ASSIGN_TEAM`, `WR_DIVISION_LEAD_APPROVE`, `WR_DIVISION_LEAD_REQUEST_REVISION` |
| team_lead | `VIEW_WORK_REQUEST`, `REQUEST_WORKFLOW_INFO`, `RESPOND_WORKFLOW_INFO`, `WR_ASSIGN_MEMBER`, `WR_TEAM_LEAD_APPROVE`, `WR_TEAM_LEAD_REQUEST_REVISION` |
| division_member | `ADD_WORK_REQUEST_DOCUMENT`, `ADD_WORK_REQUEST_NOTE`, `REQUEST_WORKFLOW_INFO`, `RESPOND_WORKFLOW_INFO`, `VIEW_WORK_REQUEST`, `WR_SUBMIT` |
| tms_manager, tms_drawing, tms_checking, tms_approval, client_owner | No new `WR_*`, `VIEW_WORK_REQUEST`, or `UPDATE_WORK_REQUEST` grant. Any pre-existing generic information capability still requires the Work Request relationship and scope checks; it does not authorize Work Request workflow access by itself. |

No new Work Request permission is custom-role eligible. `ASSIGN_MEMBER`, `ASSIGN_LEADER`, `PM_MEMBER_SUBMIT`, and all other legacy permissions remain independent and do not authorize the new Work Request transitions.

State-changing work runs in one UnitOfWork: validate current event/transition/scope; close/insert applicable assignment history; write action-specific record and append the event; update an allowed projection; and enqueue the Work Request-owned outbox event. Retries use current correlation/idempotency conventions; duplicate side effects must not create duplicate event, assignment, or notification intent.

## Integrations and non-goals

Bid Detail and Project Detail may expose related Work Requests through their own read models/events; Work Request must not directly import either feature module. It publishes outbox events and consumers restore TenantContext before persistence.

Out of scope: Bid/Project redesign implementation, category management, document-code management, Team membership management, workflow configuration management, notification delivery, revision implementation beyond its contract foundation, storage redesign, and all schema/database changes.

## Transition matrix

| Current state | Action | Capability and required relationship | Resulting state | Assignment/event/outbox |
|---|---|---|---|---|
| — | Create Work Request | `ADD_WORK_REQUEST`; parent readable and creation-eligible | `CREATED` | `WORK_REQUEST_CREATED`; no assignment; outbox |
| `CREATED` | Assign Division | `WR_ASSIGN_DIVISION`; actor has Division scope; target active/same tenant | `DIVISION_ASSIGNED` | close/rewrite Division level only as applicable; `DIVISION_ASSIGNED`; outbox |
| `DIVISION_ASSIGNED` | Reassign Division | `WR_ASSIGN_DIVISION`; actor has Division scope; target active/same tenant | `DIVISION_ASSIGNED` | close active Division row, insert successor; `DIVISION_REASSIGNED`; outbox |
| `DIVISION_ASSIGNED` | Assign Team | `WR_ASSIGN_TEAM`; actor controls assigned Division; Team active/in Division | `TEAM_ASSIGNED` | insert Team history; `TEAM_ASSIGNED`; outbox |
| `TEAM_ASSIGNED` | Reassign Team | `WR_ASSIGN_TEAM`; actor controls assigned Division; Team active/in Division | `TEAM_ASSIGNED` | close active Team row, insert successor; `TEAM_REASSIGNED`; outbox |
| `TEAM_ASSIGNED` | Assign Member | `WR_ASSIGN_MEMBER`; actor controls assigned Team; active TeamMember | `MEMBER_ASSIGNED` | insert Member history; `MEMBER_ASSIGNED`; outbox |
| `MEMBER_ASSIGNED` | Reassign Member | `WR_ASSIGN_MEMBER`; actor controls assigned Team; active TeamMember | `MEMBER_ASSIGNED` | close active Member row, insert successor; `MEMBER_REASSIGNED`; outbox |
| `MEMBER_ASSIGNED` | Submit work | `WR_SUBMIT`; active assigned Member actor | `MEMBER_SUBMITTED` | `WORK_SUBMITTED`; outbox |
| `MEMBER_SUBMITTED` | Team Lead approve | `WR_TEAM_LEAD_APPROVE`; exact assigned Team Lead scope | `TEAM_LEAD_APPROVED` | `TEAM_LEAD_APPROVED`; outbox |
| `MEMBER_SUBMITTED` | Team Lead request revision | `WR_TEAM_LEAD_REQUEST_REVISION`; exact Team scope | `MEMBER_ASSIGNED` | `REVISION_REQUESTED` with return level MEMBER; outbox |
| `TEAM_LEAD_APPROVED` | Division Lead approve | `WR_DIVISION_LEAD_APPROVE`; assigned Division scope | `DIVISION_LEAD_APPROVED` | `DIVISION_LEAD_APPROVED`; outbox |
| `TEAM_LEAD_APPROVED` | Division Lead request revision | `WR_DIVISION_LEAD_REQUEST_REVISION`; assigned Division scope | `TEAM_ASSIGNED` | `REVISION_REQUESTED` with return level TEAM; outbox |
| `DIVISION_LEAD_APPROVED` | Division Head approve | `WR_DIVISION_HEAD_APPROVE`; configured Division Head scope | `DIVISION_HEAD_APPROVED` | `DIVISION_HEAD_APPROVED`; outbox |
| `DIVISION_LEAD_APPROVED` | Division Head request revision | `WR_DIVISION_HEAD_REQUEST_REVISION`; configured Division Head scope | `DIVISION_ASSIGNED` | `REVISION_REQUESTED` with return level DIVISION; outbox |
| configured active state | Request Info | `REQUEST_WORKFLOW_INFO`; scoped participant/relationship | unchanged | clarification + `REQUEST_INFO`; outbox |
| unchanged main state | Respond Info | `RESPOND_WORKFLOW_INFO`; designated recipient | unchanged | response + `RESPOND_INFO`; outbox |

Division reassignment is allowed only while the request is `DIVISION_ASSIGNED`; Team reassignment only while `TEAM_ASSIGNED`; Member reassignment only while `MEMBER_ASSIGNED`. Each closes the replaced active row and appends a reassignment event. A configured future exception may expand this matrix, never a client-supplied target state.

After `DIVISION_HEAD_APPROVED`, Module 10 has completed its internal-review milestone and stops. It records the approval event/audit history and publishes its completion fact; it does not route to PM, TMS, CCR, or a named Division/Team. A future configured workflow resolver consumes that completion fact and determines the next stage.

## OWNER DECISION REQUIRED

## Phase C2 nested clarification

Information requests are an append-only side workflow. A root has no parent; a child references an earlier request on the same Work Request. Main state is unchanged, child response closes only the child, and nesting is arbitrary. Requests are allowed through `CLIENT_REVISION_REQUESTED` including `FINAL_RELEASE` and `CLIENT_REVIEW`, but not `ACCEPTED`/`REJECTED`.

Internal participants are active same-tenant Members with an active request responsibility. External participants are active ClientContacts linked to the exact parent Client in visible review context. Permission, compatible scope, exact relationship, exact target, and open status are required; no role/title/organization label authorizes access. A child requester must be the parent requester or target. Reassignment never retargets history. Writes are idempotent and transactional; notifications go to the exact target/requester via outbox.

`REQUEST_INFO` is compatible with `client` and `client_contact` scopes solely so a granted external ClientContact may initiate a C2 clarification. Compatibility never grants access: active contact, exact parent Client, externally visible lifecycle context, valid participant target, and request state remain mandatory.

No unresolved owner decision blocks the Module 10 V1 contract. Creation is eligible only for Bid `BIDDING` and Direct Project `ACTIVE`. Files require positional `documentCodeIds[]`, with no unclassified or partial mapping.

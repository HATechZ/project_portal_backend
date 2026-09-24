# SPEC: 10 — Work Requests

**Status:** Draft — Gates 1–3. **Runtime target:** `src/work-request/**`. **API base:** `/api/v1/work-requests`.

## Purpose and boundary

Work Request is a tenant-owned operational aggregate initiated against exactly one independent Bid or Project. It owns request creation, routing assignments, workflow event/audit history, request-info clarification, safe Work Request files, and backend-derived available actions. It does not merge Bid and Project, create a workspace/BidProject, own Team membership, or own document-code catalogues.

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

The hierarchy describes routing authority, not hard-coded role checks. Every command requires authenticated User, trusted TenantContext, eligible active ActorProfile/role grant, configured action permission, object scope, request/parent/organization relationship, and valid current workflow state. The backend computes `availableActions`; clients must not reconstruct this matrix.

`CREATED` is the canonical initial state. The minimal configured state sequence is `CREATED` → `DIVISION_ASSIGNED` → `TEAM_ASSIGNED` → `MEMBER_ASSIGNED` → `MEMBER_SUBMITTED` → `TEAM_LEAD_APPROVED` → `DIVISION_LEAD_APPROVED` → `DIVISION_HEAD_APPROVED`. These are states, not actions or audit-event names. `WORK_REQUEST_CREATED`, assignments, submissions, approvals, revision requests, resubmissions, reassignment, request-info, and respond-info are events/actions. `REVISION_REQUESTED` is an audit/action record that returns the request to the appropriate responsible state; it is not an ambiguous replacement for that state. No generic `REJECTED`/`RETURNED` terminal state is introduced: a reviewer’s non-terminal return is the explicit revision path, and any terminal rejection requires a separately configured terminal transition.

The current action catalogue supplies `ADD_WORK_REQUEST`, `ADD_WORK_REQUEST_DOCUMENT`, `ADD_WORK_REQUEST_NOTE`, `REQUEST_WORKFLOW_INFO`, `RESPOND_WORKFLOW_INFO`, and `ASSIGN_MEMBER`; only the first five are Work Request capabilities. Approved new catalogue codes are `VIEW_WORK_REQUEST`, `UPDATE_WORK_REQUEST`, `WR_ASSIGN_DIVISION`, `WR_ASSIGN_TEAM`, `WR_ASSIGN_MEMBER`, `WR_SUBMIT`, `WR_TEAM_LEAD_APPROVE`, `WR_TEAM_LEAD_REQUEST_REVISION`, `WR_DIVISION_LEAD_APPROVE`, `WR_DIVISION_LEAD_REQUEST_REVISION`, `WR_DIVISION_HEAD_APPROVE`, and `WR_DIVISION_HEAD_REQUEST_REVISION`. Authorization is never inferred from role names.

### Fixed-role permission baseline

The fixed system-role code `system_admin` is the persisted backing code for the tenant-super-admin role. It is not an authorization bypass. The following baseline grants are only the Work Request permissions; every command additionally requires authenticated tenant context, an active ActorProfile and role assignment, the permission, current Work Request state, object scope, organization relationship, and an active Work Request assignment where the transition requires one.

| Fixed role | Work Request permission baseline |
|---|---|
| tenant_super_admin (`system_admin`) | `ADD_WORK_REQUEST`, `ADD_WORK_REQUEST_DOCUMENT`, `ADD_WORK_REQUEST_NOTE`, `REQUEST_WORKFLOW_INFO`, `RESPOND_WORKFLOW_INFO`, `VIEW_WORK_REQUEST`, `UPDATE_WORK_REQUEST` |
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

No unresolved owner decision blocks the Module 10 V1 contract. Creation is eligible only for Bid `BIDDING` and Direct Project `ACTIVE`. Files require positional `documentCodeIds[]`, with no unclassified or partial mapping.

# SPEC: 04.3 - Team

**Status:** Gate 3 approved target, implementation delta required  
**Tables owned:** `teams` and its existing `team_members` relation  
**Dependencies:** `04.2-member`; implementation order is Division -> Member -> Team

## 1. Overview & Business Intent

Team is an organizational grouping inside one Company Division. It is not a workflow stage,
Division, User/login identity, or ActorRole; `team_lead` is a separate ActorRole whose exact
Team object scope is proven by `Team.leadMemberId`. This module owns Team CRUD, Team Lead
assignment, and association of eligible Members through `team_members`. The Member may already
exist or may have been created through the separate `04.2-member` flow immediately before
assignment. This relation is not a separate business person, feature module, or specification.

## Current backend, approved target, and deferred matters

**Current backend:** the Team feature module implements Team CRUD, scoped lead assignment, and
Team-owned membership behavior, but it still needs reconciliation for `division_head` and real
`team_lead` ActorRole authority before implementation is complete. **Deferred:** workflow
routing implementation, TMS/classification, activation lifecycle, and any schema/grant/RLS/
database change.

## 2. User Stories

- **US-01:** As a same-Company `system_admin`, I want to manage Teams in the Company.
- **US-02:** As a `division_head`, I want to manage Teams across own-Company Divisions according
  to configured permissions.
- **US-03:** As a `division_lead`, I want to manage Teams, leads, and eligible Members only
  inside the Division represented by my active ActorProfile's Member.
- **US-04:** As the `team_lead` of a Team, I want to add or end an eligible Member's membership
  in that exact Team, provided configured permission and scope also allow it.

## 3. Domain Rules

| # | Rule | Enforced by |
|---|---|---|
| DR-01 | A Team belongs to authenticated Tenant, its one Company, and a scoped Division; ownership is never caller input. | context/service, composite Division FK, RLS |
| DR-02 | `system_admin` manages Teams only in own Company with `ADD_TEAM`; no platform/wildcard bypass exists. | guard/permission/object scope |
| DR-03 | `division_head` manages Teams across own-Company Divisions according to configured permissions and may delete any otherwise-deletable Team in those Divisions. | role/permission/object scope |
| DR-04 | `division_lead` creates/manages Teams and assigns/changes Team Lead only where active ActorProfile -> Member -> `divisionId` equals target Team Division. It requires configured `ADD_TEAM`. | Division scope resolver |
| DR-05 | `team_lead` may add/end Member membership and route Team work only where actor Member ID equals exact Team `leadMemberId`, and only with configured permission. `Team.leadMemberId` is required object-scope evidence; role alone cannot control another Team. | exact Team scope resolver and permissions |
| DR-06 | Leadership assignment scope is validated at assignment time: system_admin -> own Company; division_head -> own Company / target Division; division_lead -> own Division / target Team; team_lead -> exact Team. Role assignment alone never bypasses object scope. | assignment service validation |
| DR-07 | Team Lead cannot create Division; cannot manage another Team; and cannot assign cross-Team Members. Team Lead Member creation authority lives in `04.2-member` and is limited to exact led-Team scope. | route authorization/tests |
| DR-08 | Selected Team Lead and every Team Member must be active Members of same Tenant, Company, and Division as Team before assignment. User access is not required. | service validation; existing structural keys/RLS |
| DR-09 | `team_members` preserves `joinedAt`, nullable `leftAt`, and nullable `teamRole`. Adding creates an active association; ending sets `leftAt`, never deletes history. Re-adding after end creates a new association. | membership transaction |
| DR-10 | Team name is unique within `(tenantId,divisionId)`. Core update changes name only; Tenant/Company/Division/ID/lead/activation/timestamps are not generic update fields. Lead and membership have dedicated routes. | DTO allow-lists/constraint |
| DR-11 | Delete is guarded hard delete: any membership row, including ended history, blocks it. It never deletes membership/history. `division_head` may delete any otherwise-deletable Team in own-Company Divisions when configured permission and object scope pass. `isActive` remains structural; no activation lifecycle endpoint is approved. | delete audit/API exclusion |
| DR-12 | `division_lead` may add existing or newly created eligible Members to Teams only in their own Division. `team_lead` may add existing or newly created eligible Members only to the exact Team they lead and may remove Members only from that exact Team. | membership authorization/tests |
| DR-13 | Team membership add/remove never authorizes cross-Tenant/Company/Division Member operations, invalid cross-Team Member assignment, or general Division browsing/administration. | scoped queries/tests |

## 4. Failure Modes

| Condition | HTTP | `AppErrorCode` |
|---|---:|---|
| Invalid DTO/UUID/unknown field or invalid teamRole bounds | 400 | `BAD_REQUEST` / `VALIDATION_FAILED` |
| Missing/foreign Team, Member, or active membership | 404 | `NOT_FOUND` |
| Missing/invalid bearer or inactive security context | 401 | `UNAUTHORIZED` |
| Absent configured action; role/scope mismatch; Team Lead on another Team | 403 | `FORBIDDEN` |
| Duplicate Team name, duplicate active membership, incompatible lead/member, delete history block, FK/serialization race | 409 | `CONFLICT` |

## 5. EARS Acceptance Criteria

- `[AC-U01]` The module SHALL use app_user, Tenant UnitOfWork, RLS, configured permission, and object scope; caller Tenant/Company cannot affect scope.
- `[AC-U02]` The module SHALL never create a Member, a User, or a TeamMember feature/module, and SHALL never infer Team object scope from `team_lead` role alone.
- `[AC-E01]` WHEN system_admin creates a valid Team in own Company, the system SHALL persist it under the scoped Division.
- `[AC-E02]` WHEN division_lead manages a Team or assigns its lead, the system SHALL verify the active actor Member's Division equals the Team Division.
- `[AC-E03]` WHEN `team_lead` adds or ends membership, the system SHALL verify exact `leadMemberId` equality plus `ASSIGN_MEMBER`, then preserve membership history.
- `[AC-E04]` WHEN `division_head` deletes a Team, the system SHALL allow it only for an otherwise-deletable Team in own-Company Divisions with configured permission and SHALL deny cross-Tenant or cross-Company targets.
- `[AC-S01]` WHILE a candidate Member is cross-Tenant, cross-Company, cross-Division, or inactive, the system SHALL deny lead assignment and membership.
- `[AC-S02]` WHILE a product flow creates a Member before Team assignment, the system SHALL keep Member creation and Team assignment as separate operations and SHALL not auto-persist membership from Member creation.
- `[AC-W01]` IF a Team Lead attempts another-Team operations, THEN the system SHALL return 403.
- `[AC-W02]` IF any membership history exists, THEN Team deletion SHALL return 409 without deleting rows.

## 6. Out of Scope

No workflow routing implementation, WorkRequest.teamId decision, fixed teams/counts,
name-based routing, Team-to-Team transition, identity, or public activation lifecycle.
`ASSIGN_MEMBER` already exists as the minimal configured action for membership management; this
module invents no new permission code. Work Request routing later must be Division Head ->
Division Lead -> Team Lead -> Member, with each level controlling only its approved assignment
scope. Unresolved TMS/company/workflow-classification meaning is deferred.
No schema, Prisma, DBML, migration, grant, RLS, or database operation is authorized. Seed data may
grant existing `ADD_TEAM` to `division_lead` because approved Team creation requires a configured
permission and no new permission is introduced.

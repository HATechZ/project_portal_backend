# SPEC: 04.2 — Member

**Status:** Gate 3 · approved target · not implemented  
**Tables owned:** `members`; integrates narrowly with `users`, `user_roles`, and `actor_profiles`  
**Dependencies:** `04.1-division`; precedes `04.3-team`

## 1. Overview & Business Intent

Member is an internal Company/Division business person. User is a separate authentication and
security identity. A Division has no login; a Member may have no User and may have no Team.
Member is the organizational identity used by Division membership, Team leadership/membership,
work-request member assignment, and ActorProfile business context.

## Current backend, approved target, and deferred matters

**Current backend:** User/roles/ActorProfiles and Company are implemented separately; there is no
Member feature module or route. The nullable current Member-to-User relation is structural truth.
**Approved target:** separate Member CRUD and explicit integration boundaries below. **Not
implemented:** every task in `tasks.md`. **Deferred:** identity policy changes, Team behavior,
workflow/TMS classification, and all schema/grant/RLS work.

## 2. User Stories

- **US-01:** As a same-Company `system_admin`, I want to create and maintain an internal Member
  in a selected Division without being forced to create portal credentials.
- **US-02:** As a same-Company `system_admin`, I want to link an existing appropriate portal
  identity and its existing eligible ActorProfile to a Member without duplicating identity logic.

## 3. Domain Rules

| # | Rule | Enforced by |
|---|---|---|
| DR-01 | Member belongs to authenticated Tenant, the one scoped Company, and a scoped Division; caller controls none of those ownership values. | context/service, Division composite FK, RLS |
| DR-02 | Member and User are distinct. Creating a User or assigning UserRole never creates a Member; creating a Member never creates User, password, session, role, or ActorProfile. | separate DTOs/services and tests |
| DR-03 | `userId` is optional under the current schema. A Member may exist without User and without Team. | nullable relation; DTO/API behavior |
| DR-04 | Only same-Company `system_admin` with `ADD_MEMBER` may create a new Member. `division_lead` and contextual Team Lead cannot create one. | guards/permission/object scope |
| DR-05 | A linked User, ActorProfile, and Member must all be same Tenant; an ActorProfile link also requires its User to equal `Member.userId`, an active profile, and active matching UserRole. | narrow linking transaction and validation |
| DR-06 | Member business fields are `name`, `email`, `roleTitle`, `divisionId`, and retained `isActive` where current schema/API supports them. Tenant, Company, ID, User/ActorProfile linkage, and timestamps are not ordinary update fields. | DTO allow-lists |
| DR-07 | Member email is unique per Tenant. Do not treat it as a credential or substitute it for User's global canonical login email. | validation/constraint mapping |
| DR-08 | A guarded hard delete must refuse when any Member relation is present; it never deletes, revokes, clears, or rewrites dependent history/identity data. | dependency audit |
| DR-09 | A Division move is allowed only to a scoped same-Company Division and must be blocked while the Member leads a Team or has an active Team membership in a different Division. | update validation and Team relation probes |

## 4. Failure Modes

| Condition | HTTP | `AppErrorCode` |
|---|---:|---|
| Invalid DTO/UUID, bad string bounds, forbidden ownership/security input | 400 | `BAD_REQUEST` / `VALIDATION_FAILED` |
| Missing/foreign Member, Division, User, or ActorProfile | 404 | `NOT_FOUND` |
| Missing/invalid bearer or inactive auth context | 401 | `UNAUTHORIZED` |
| Caller lacks configured action/scope, or non-admin attempts new Member creation | 403 | `FORBIDDEN` |
| Duplicate Member email, invalid link state, dependency delete block, FK/serialization race | 409 | `CONFLICT` |

## 5. EARS Acceptance Criteria

- `[AC-U01]` The module SHALL preserve User and Member as separate records and SHALL never infer one from role assignment.
- `[AC-U02]` The module SHALL use app_user, normal Tenant UnitOfWork, RLS, configured permission, and object scope; system administration is not a wildcard bypass.
- `[AC-E01]` WHEN an eligible system administrator creates a Member, the system SHALL persist only that business person in the selected scoped Division.
- `[AC-E02]` WHEN portal access is requested, the system SHALL perform the four distinct steps: create Member; provision/link a User; assign UserRole; create/link ActorProfile. Each may be independently needed and none is implied by an earlier step.
- `[AC-E03]` WHEN a Member is linked to existing access records, the system SHALL validate same Tenant and active UserRole/Profile consistency in one transaction and change only approved link fields.
- `[AC-S01]` WHILE a Member has no User or Team, the system SHALL allow the Member record to remain valid.
- `[AC-W01]` IF a caller supplies Tenant/Company/UserRole/password/session/Team data to Member creation or ordinary update, THEN validation SHALL reject it before persistence.
- `[AC-W02]` IF any current Member relation exists, THEN deletion SHALL return 409 without modifying related rows.
- `[AC-W03]` IF a Division move would leave an active Team lead/membership cross-Division, THEN the system SHALL return 409 until the lead is reassigned or active membership ended.

## 6. Out of Scope

Authentication, User credential provisioning, password/session handling, UserRole grant/revocation,
and ActorProfile activation remain module 03 capabilities; this module must not duplicate them.
The product may orchestrate their existing endpoints with this module's Member/link endpoints.
Team membership/leadership is only `04.3-team`; no `Member.teamId`, membership module, or
persisted Team member-ID array is permitted. No schema, migration, RLS, grant, seed, or
database change is authorized. TMS/workflow classification is deferred.

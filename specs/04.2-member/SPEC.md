# SPEC: 04.2 - Member

**Status:** Gate 3 approved target, implementation delta in progress
**Tables owned:** `members`; integrates narrowly with `users`, `user_roles`, and `actor_profiles`
**Dependencies:** `04.1-division`; precedes `04.3-team`

## 1. Overview & Business Intent

Member is an internal Company/Division business person. User is a separate authentication and
security identity. A Division has no login. In V1, every newly created internal Member receives
working login/access immediately, while Team assignment remains separate.

Member is the organizational identity used by Division membership, Team leadership/membership,
work-request member assignment, and ActorProfile business context.

## Current backend, approved target, and deferred matters

**Current backend:** Member CRUD, scoped authorization, and exceptional existing-User access-link
exist. User/roles/ActorProfiles and Company remain implemented separately.

**Approved target:** `POST /member` is the normal V1 onboarding operation and atomically
creates/links:

```text
User -> Member -> UserRole -> Member-backed ActorProfile
```

`PUT /member/:id/access-link` remains only the exceptional existing-User path. It is not the normal
new-Member onboarding flow.

**Deferred:** invitation, set-password links, email verification, temporary passwords,
reset-on-first-login, workflow/TMS classification, and unrelated schema/grant/RLS work.

## 2. User Stories

- **US-01:** As an authorized organization actor, I want to create an internal Member only inside
  my approved Tenant/Company/Division scope and have that Member receive working login/access
  immediately.
- **US-02:** As a same-Company `system_admin`, I want to link an existing appropriate identity and
  its existing eligible ActorProfile to a Member without duplicating identity logic.

## 3. Domain Rules

| # | Rule | Enforced by |
|---|---|---|
| DR-01 | Member belongs to authenticated Tenant, the one scoped Company, and a scoped Division; caller controls none of those ownership values. | context/service, Division composite FK, RLS |
| DR-02 | Member and User are distinct. Normal V1 Member creation atomically creates and links User, UserRole, and Member-backed ActorProfile records, but does not merge their models or duplicate Auth/session logic. | DTOs/services/tests |
| DR-03 | `userId` remains nullable structural truth for legacy/exceptional paths, but every newly created Member through `POST /member` has linked User access. A Member may still have no Team. | nullable relation; onboarding transaction |
| DR-04 | Member and leadership creation authority is scoped: `system_admin` may create Members and provision/assign `division_head` anywhere in own Company; `division_head` may create/provision or assign `division_lead` only for a Division inside the same Company; `division_lead` may create/provision or assign `team_lead` only for a Team inside that Division; `team_lead` may manage/create eligible ordinary Members only within exact Team scope. All require configured permission, object scope, and same Tenant/Company/Division/Team validation. | guards/permission/object scope |
| DR-05 | A linked User, UserRole, ActorProfile, and Member must all be same Tenant; the ActorProfile must be active and Member-backed. | onboarding/linking transaction |
| DR-06 | Public Member create fields are `name`, `email`, `password`, `divisionId`, `roleId`, optional `designation`, and optional `phone`. Tenant, Company, ID, User/ActorProfile linkage, password hash, Team, and active state are not caller-controlled. | DTO allow-lists |
| DR-07 | Member email is unique per Tenant. User email uses the same request email and remains the credential login email. | validation/constraint mapping |
| DR-08 | Delete removes a Member from active organization use atomically: it ends active Team membership, revokes Member-backed UserRoles/sessions, disables Member-backed ActorProfiles, and marks the Member inactive. Historical business/workflow/audit rows remain. Active Division leadership remains a 409 reassignment dependency. | removal transaction |
| DR-09 | A Division move is allowed only to a scoped same-Company Division and must be blocked while the Member leads a Team or has an active Team membership in a different Division. | update validation and Team relation probes |
| DR-10 | For `team_lead` Member creation, allowed Team context is derived from authenticated User -> active ActorProfile with `team_lead` role -> Member -> Team where `Team.leadMemberId` equals the actor Member. `Team.leadMemberId` is required object-scope evidence; role alone cannot authorize another Team or Division. | exact Team scope resolver |
| DR-11 | Creating a Member never assigns that Member to a Team at persistence level. Team assignment is a distinct `04.3-team` operation, even when a product flow performs create then assign sequentially. | service boundaries/tests |
| DR-12 | Designation and phone are business profile fields only. Designation must never determine authorization; `roleId` drives UserRole assignment. | DTO/service validation |
| DR-13 | Read scope is limited: `system_admin` and configured `division_head` read own Company Members; `division_lead` reads own Division Members; `team_lead` may read only exact led-Team context and eligible same-Team Members required for own-Team Member operations. | scoped queries/tests |
| DR-14 | Creating any leadership user reuses normal atomic onboarding: `User -> Member -> UserRole -> Member-backed ActorProfile`. Separate leader identity models, leader-only tables, and role assignment without object-scope validation are forbidden. | onboarding transaction/scope validation |

## 4. Failure Modes

| Condition | HTTP | `AppErrorCode` |
|---|---:|---|
| Invalid DTO/UUID, bad string bounds, forbidden ownership/security input | 400 | `BAD_REQUEST` / `VALIDATION_FAILED` |
| Missing/foreign Member, Division, User, Role, or ActorProfile | 404 | `NOT_FOUND` |
| Missing/invalid bearer or inactive auth context | 401 | `UNAUTHORIZED` |
| Caller lacks configured action/scope, or attempts Member creation outside approved Tenant/Company/Division scope | 403 | `FORBIDDEN` |
| Duplicate Member/User email, invalid role, invalid link state, dependency delete block, FK/serialization race | 409 | `CONFLICT` |

## 5. EARS Acceptance Criteria

- `[AC-U01]` The module SHALL preserve User and Member as separate records.
- `[AC-U02]` The module SHALL use app_user, normal Tenant UnitOfWork, RLS, configured permission,
  and object scope; system administration is not a wildcard bypass.
- `[AC-E01]` WHEN an eligible `system_admin`, `division_head`, `division_lead`, or `team_lead` creates a
  Member, the system SHALL atomically persist User, Member, UserRole, and Member-backed
  ActorProfile inside the actor's approved Tenant/Company/Division scope.
- `[AC-E02]` WHEN `POST /member` succeeds, the response SHALL not include plaintext password,
  password hash, session, or token data.
- `[AC-E03]` WHEN a Member is linked to existing access records through `access-link`, the system
  SHALL validate same Tenant and active UserRole/Profile consistency in one transaction and change
  only approved link fields.
- `[AC-S01]` WHILE a legacy or exceptional Member has no User or Team, the system SHALL allow the
  Member record to remain structurally valid, but normal new Member onboarding SHALL create login
  access.
- `[AC-W01]` IF a caller supplies Tenant/Company/User/ActorProfile/passwordHash/confirmPassword/
  isActive/session/Team data to Member creation or ordinary update, THEN validation SHALL reject it
  before persistence.
- `[AC-W02]` IF onboarding fails after any intermediate step, THEN the transaction SHALL roll back
  and leave no incomplete Member/User/UserRole/ActorProfile state.
- `[AC-W03]` WHEN a Member is removed, THEN active access is revoked and the Member is inactive;
  historical workflow, audit, role, profile, Team, and leadership rows remain. Active Division
  leadership returns 409 until reassigned or revoked.
- `[AC-W04]` IF a Division move would leave an active Team lead/membership cross-Division, THEN the
  system SHALL return 409 until the lead is reassigned or active membership ended.
- `[AC-W05]` IF a `division_head`, `division_lead`, or `team_lead` attempts to create a Member outside their
  allowed Division, THEN the system SHALL return 403 or an indistinguishable scoped 404 without
  creating any row.
- `[AC-W06]` IF `roleId` is missing, foreign, inactive/unavailable, or not an allowed internal
  Member role, THEN `POST /member` SHALL fail without creating partial onboarding state.
- `[AC-W07]` IF a leadership assignment targets an out-of-scope Company, Division, Team, or
  ordinary Member, THEN the system SHALL deny it even when the caller has the requested role.

## 6. Out of Scope

Authentication, password validation/hashing, session handling, UserRole grant/revocation, and
ActorProfile activation remain module 03 capabilities. `POST /member` reuses those existing
mechanisms as an atomic onboarding orchestration and must not duplicate Auth/session logic or invent
invitation, set-password, email verification, temporary-password, or reset-on-first-login behavior.

Team membership/leadership is only `04.3-team`; Member creation never persists Team assignment,
and no `Member.teamId`, membership module, or persisted Team member-ID array is permitted. No
schema, migration, RLS, grant, seed, or database change is authorized for this onboarding change.
TMS/workflow classification is deferred.

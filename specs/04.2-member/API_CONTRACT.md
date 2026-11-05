# API Contract: 04.2 — Member

Base `/api/v1`; inherits platform envelope, pagination, UUID validation, centralized errors, and
`x-request-id` behavior.

## Authorization

## 2026-10-07 Staff-onboarding reconciliation

The `POST /member` body and response remain unchanged. On successful creation the backend
internally resolves protected same-Tenant Staff and atomically ensures a Staff UserRole plus
Member-backed ActorProfile; no security ID is accepted or returned. This is baseline access only:
it never assigns Supervisor/Manager, Team or Division leadership/membership, or workflow work.
Later explicit roles retain Staff. The existing route table's contrary no-role wording is
superseded by this section.

## Authorization

Routes require authenticated JWT-derived Tenant context, active session/User/ActorProfile,
ordinary object scope, configured permissions, and no caller-controlled Tenant/Company. Member
creation is scoped by actor authority: `tenant_super_admin` may create anywhere in own Company and may
create/provision or assign `division_head`; `division_head` may create/provision or assign
`division_lead` only for a Division inside the same Company; `division_lead` may create/provision
or assign `team_lead` only for a Team inside that Division; `team_lead` may manage/create eligible
ordinary Members only within exact Team scope. Team Lead context is derived from authenticated
User -> active ActorProfile with `team_lead` role -> Member -> Team where `Team.leadMemberId`
equals the actor Member. Role assignment alone does not bypass object scope. Ordinary
update/delete and access linking remain same-Company `tenant_super_admin` operations unless a later
contract explicitly approves more. There is no wildcard: configured action/scope remain required.

Read scope is equally bounded. `tenant_super_admin` and configured `division_head` read own Company
Members, `division_lead` reads own Division Members, and `team_lead` may read only their exact
led-Team context and eligible same-Team Members needed for own-Team Member operations. This does
not grant general Division administration or all-Division browsing.

## Member routes

| Method | Path | DTO / result |
|---|---|---|
| POST | `/member` | `{ name, email, password, divisionId, designationId, phone? }`; derives Tenant/Company, validates actor-scoped Division and same-Tenant/Company Designation, and creates linked User and Member atomically; 201. `roleId`, `tenantId`, `companyId`, `userId`, `actorProfileId`, `passwordHash`, `confirmPassword`, `isActive`, and `teamId` are forbidden. It does not assign a UserRole, ActorProfile, or Team membership. |
| POST | `/member/from-existing-user` | `{ userId, actorProfileId, divisionId, designationId, phone? }`; requires `CREATE_MEMBER` and `LINK_MEMBER_ACCESS`. Derives Member name/email from the active same-Tenant User, validates an active internal same-User ActorProfile with an active matching UserRole, active scoped Company/Division, and same-Company Designation. Atomically creates the missing Member and links the supplied existing ActorProfile; 201. It never creates a User, credential, UserRole, or ActorProfile. A replay returns the Member only when that same User/Profile relationship already exists. |
| GET | `/member` | Scoped page, optional `divisionId` filter only after scoped validation; `name asc,id asc`; 200 items/meta. |
| GET | `/member/:id` | 200 scoped Member or indistinguishable 404. |
| PATCH | `/member/:id` | Partial `{ name?, email?, designationId?, divisionId?, isActive? }`, at least one; validate supplied same-Tenant/Company Designation; a Division move returns 409 when the Member remains the active Lead of its old Division or has conflicting Team leadership/active membership; 200. No `userId`, arbitrary designation text, or security fields. |
| DELETE | `/member/:id` | Remove a member; atomically marks the Member inactive, ends active Team membership, revokes Member access/profiles/sessions, and disables the linked User only when it has no other active identity. Historical records remain; active Division leadership returns 409. 204. |
| PUT | `/member/:id/access-link` | `{ userId, actorProfileId? }`; exceptional existing-User path only. Links existing same-Tenant User and optional existing eligible profile; 200. It does not create User, UserRole, ActorProfile, password, or session. |

Member response is exactly `id`, `userId`, `companyId`, `divisionId`, `designationId`, `name`,
`email`, `designation`, `isActive`, `createdAt`, and `updatedAt`. Relations are represented by
IDs only; User, Division, Designation, and role objects are not embedded by default.
`designation` is the related Designation name compatibility display. Role assignment is a later `POST /user/:userId/role` operation after the
Member exists; it is not part of the Member response or onboarding contract.
It never returns plaintext password, password hash, session, token, or credential material. 400
covers malformed/unknown input; 404 conceals foreign IDs; 401/403 are auth failures; 409 covers
unique/link/dependency/role and database races. Access-link success does not imply a role was
assigned or an ActorProfile default changed.

A tenant administrator account may legitimately exist without a Member-backed ActorProfile.
Member-bound business operations, including Work Request creation, require explicit Member
onboarding and their own responsibility checks.

## Assignment eligibility selector

GET /api/v1/member/eligible?divisionId=<uuid> selects Division Lead candidates; GET /api/v1/member/eligible?teamId=<uuid> selects Team Lead/Team Member candidates using the Team's persisted Division. Exactly one context is required. VIEW_MEMBERS plus Company, actively led Division, or exact led Team resource scope is enforced; member/external scopes cannot browse a Division through this selector. Missing/foreign/inactive targets return 404. No context or both contexts return 400.

The standard envelope data array contains memberId, name, email, isTeamLead, activeTeamMemberships [{teamId,name,teamRole,isTeamLead}], and ledTeams [{teamId,name}]. Membership is leftAt=null on active same-Tenant/Company/Division Teams; lead metadata also covers led Teams without a TeamMember row. No membership exclusion is applied. Existing GET /member remains the general paginated directory.

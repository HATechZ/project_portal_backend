# API Contract: 04.2 — Member

Base `/api/v1`; inherits platform envelope, pagination, UUID validation, centralized errors, and
`x-request-id` behavior.

## Authorization

Routes require authenticated JWT-derived Tenant context, active session/User/ActorProfile,
ordinary object scope, configured permissions, and no caller-controlled Tenant/Company. Member
creation is scoped by actor authority: `system_admin` may create anywhere in own Company and may
create/provision or assign `division_head`; `division_head` may create/provision or assign
`division_lead` only for a Division inside the same Company; `division_lead` may create/provision
or assign `team_lead` only for a Team inside that Division; `team_lead` may manage/create eligible
ordinary Members only within exact Team scope. Team Lead context is derived from authenticated
User -> active ActorProfile with `team_lead` role -> Member -> Team where `Team.leadMemberId`
equals the actor Member. Role assignment alone does not bypass object scope. Ordinary
update/delete and access linking remain same-Company `system_admin` operations unless a later
contract explicitly approves more. There is no wildcard: configured action/scope remain required.

Read scope is equally bounded. `system_admin` and configured `division_head` read own Company
Members, `division_lead` reads own Division Members, and `team_lead` may read only their exact
led-Team context and eligible same-Team Members needed for own-Team Member operations. This does
not grant general Division administration or all-Division browsing.

## Member routes

| Method | Path | DTO / result |
|---|---|---|
| POST | `/member` | `{ name, email, password, divisionId, roleId, designation?, phone? }`; derives Tenant/Company, validates actor-scoped Division, creates User, Member, UserRole, and Member-backed ActorProfile atomically; 201. `tenantId`, `companyId`, `userId`, `actorProfileId`, `passwordHash`, `confirmPassword`, `isActive`, and `teamId` are forbidden. It does not assign the Member to a Team. |
| GET | `/member` | Scoped page, optional `divisionId` filter only after scoped validation; `name asc,id asc`; 200 items/meta. |
| GET | `/member/:id` | 200 scoped Member or indistinguishable 404. |
| PATCH | `/member/:id` | Partial `{ name?, email?, roleTitle?, divisionId?, isActive? }`, at least one; 200. No `userId` or security fields. |
| DELETE | `/member/:id` | Remove a member; atomically marks the Member inactive, ends active Team membership, revokes Member access/profiles/sessions, and disables the linked User only when it has no other active identity. Historical records remain; active Division leadership returns 409. 204. |
| PUT | `/member/:id/access-link` | `{ userId, actorProfileId? }`; exceptional existing-User path only. Links existing same-Tenant User and optional existing eligible profile; 200. It does not create User, UserRole, ActorProfile, password, or session. |

Member response is `id`, linked `userId` for normal create, read-only Company/Division context,
`name`, `email`, `roleTitle`, `isActive`, timestamps, and optional safe Division/User summaries.
It never returns plaintext password, password hash, session, token, or credential material. 400
covers malformed/unknown input; 404 conceals foreign IDs; 401/403 are auth failures; 409 covers
unique/link/dependency/role and database races. Access-link success does not imply a role was
assigned or an ActorProfile default changed.

# API Contract: 04.2 — Member

Base `/api/v1`; inherits platform envelope, pagination, UUID validation, centralized errors, and
`x-request-id` behavior.

## Authorization

Routes require authenticated JWT-derived Tenant context, active session/User/ActorProfile,
ordinary object scope, configured permissions, and no caller-controlled Tenant/Company. Member
creation is scoped by actor authority: `system_admin` may create anywhere in own Company,
`division_lead` only in their own Division, and contextual Team Lead only in the Division of the
exact Team they lead. Team Lead context is derived from authenticated User -> active ActorProfile
-> Member -> Team where `Team.leadMemberId` equals the actor Member -> `Team.divisionId`; no
`team_lead` ActorRole exists. Ordinary update/delete and access linking remain same-Company
`system_admin` operations. There is no system-admin wildcard: configured action/scope remain
required.

Read scope is equally bounded. `system_admin` reads own Company Members, `division_lead` reads
own Division Members, and contextual Team Lead may read only their own Team's Division context
and eligible same-Division Members needed for own-Team Member operations. This does not grant
general Division administration or all-Division browsing.

## Member routes

| Method | Path | DTO / result |
|---|---|---|
| POST | `/member` | `{ name, email, roleTitle, divisionId, isActive? }`; derives Tenant/Company and validates actor-scoped Division; 201. `userId`, role, password, actor profile, Team, and ownership fields forbidden. It does not assign the Member to a Team. |
| GET | `/member` | Scoped page, optional `divisionId` filter only after scoped validation; `name asc,id asc`; 200 items/meta. |
| GET | `/member/:id` | 200 scoped Member or indistinguishable 404. |
| PATCH | `/member/:id` | Partial `{ name?, email?, roleTitle?, divisionId?, isActive? }`, at least one; 200. No `userId` or security fields. |
| DELETE | `/member/:id` | Guarded hard delete; 204 only with no relation; otherwise 409. |
| PUT | `/member/:id/access-link` | `{ userId, actorProfileId? }`; link existing same-Tenant User and optional existing eligible profile; 200. It does not create User, UserRole, ActorProfile, password, or session. |

Member response is `id`, nullable `userId`, read-only Company/Division context, `name`, `email`,
`roleTitle`, `isActive`, timestamps, and optional safe Division/User summaries. It never returns
password/session/token or role-grant mutation. 400 covers malformed/unknown input; 404 conceals
foreign IDs; 401/403 are auth failures; 409 covers unique/link/dependency and database races.
Link success does not imply a role was assigned or an ActorProfile default changed.

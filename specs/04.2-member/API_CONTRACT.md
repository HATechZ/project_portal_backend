# API Contract: 04.2 — Member

Base `/api/v1`; inherits platform envelope, pagination, UUID validation, centralized errors, and
`x-request-id` behavior.

## Authorization

Routes require authenticated JWT-derived Tenant context, active session/User/ActorProfile,
ordinary object scope, configured permissions, and no caller-controlled Tenant/Company. New
Member creation, ordinary update/delete, and access linking are same-Company `system_admin`
operations requiring `ADD_MEMBER`; no `division_lead` or contextual Team Lead exception exists.
There is no system-admin wildcard: configured action/scope remain required.

## Member routes

| Method | Path | DTO / result |
|---|---|---|
| POST | `/member` | `{ name, email, roleTitle, divisionId, isActive? }`; derives Tenant/Company; 201. `userId`, role, password, actor profile, Team, and ownership fields forbidden. |
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

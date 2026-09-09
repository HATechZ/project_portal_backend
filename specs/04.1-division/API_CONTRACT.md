# API Contract: 04.1 — Division

Base: `/api/v1`. Inherits platform envelopes, pagination, validation, UUID parsing, exception
mapping, and `x-request-id` behavior from `00-platform-core`.

## Authorization

Every route requires verified bearer Tenant context, active session/User/ActorProfile, ordinary
object scope, an active same-Tenant `system_admin` ActorProfile, and configured
`WorkflowActionCode.ADD_DIVISION`. Guard ordering follows the established pattern:
`AccessTokenGuard -> TenantContextGuard -> AuthenticationGuard -> ObjectScopeGuard ->
SystemAdminGuard -> PermissionsGuard`. `system_admin` is Company/Tenant administration, not a
platform super-admin: permission and scope checks still execute. `division_lead` and contextual
Team Lead are denied. Caller Tenant/Company IDs or headers have no authority.

## Routes and DTOs

| Method | Path | Behavior |
|---|---|---|
| POST | `/division` | Create from `{ name, abbr, divisionTypeId? }`; 201. No ownership, activation, identity, lead, Team, or workflow fields. |
| GET | `/division` | Scoped paginated list, `page`/`limit`, order `name asc, id asc`; 200 `{ items, meta }`. |
| GET | `/division/:id` | Scoped detail; 200 or indistinguishable 404. |
| PATCH | `/division/:id` | Partial `{ name?, abbr?, divisionTypeId? }`, at least one defined; 200. Explicit null is rejected unless a nullable-reference clear is deliberately supported and documented in the implementation review; target default is to reject null. |
| DELETE | `/division/:id` | Guarded hard delete; 204 only when the full dependency audit is empty, otherwise 409. |

Responses expose `id`, `name`, `abbr`, `divisionTypeId`, nullable DivisionType summary,
retained `isActive`, `createdAt`, and `updatedAt`; never expose a Tenant/Company override or
login/lead representation. Invalid DTO/UUID is 400; missing/foreign is 404; unauthorized is
401/403; uniqueness, FK race, serialization, and delete dependency are 409. There is no
deactivate/reactivate endpoint.

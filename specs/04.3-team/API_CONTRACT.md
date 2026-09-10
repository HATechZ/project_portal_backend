# API Contract: 04.3 — Team

Base `/api/v1`; inherits platform envelopes, pagination, UUID parsing, centralized exception
mapping, and `x-request-id` behavior.

## Authorization and object scope

All routes use JWT-derived Tenant context, active session/User/ActorProfile, object scope, and
configured permissions. `system_admin` has `ADD_TEAM` for Team CRUD/lead assignment only in own
Company. `division_lead` additionally needs active ActorProfile → Member → Division equality to
the Team Division and `ADD_TEAM`; this owner-approved rule overrides stale system-admin-only Team
creation. For membership operations, system_admin or scoped division_lead needs `ASSIGN_MEMBER`.
A contextual Team Lead may perform those two operations only when actor Member ID equals
`Team.leadMemberId` and `ASSIGN_MEMBER` is configured. No actor role is created for this context.
Calls without applicable action or scope are 403, not bypassed by a role label.

For Team reads, a system_admin reads own Company and division_lead reads own Division with
`ADD_TEAM`; a contextual Team Lead with `ASSIGN_MEMBER` may read only exact Teams where actor
Member ID equals `leadMemberId` (the list is filtered to those Teams). Other authenticated actors
receive 403 rather than a broad organization directory.

For Member reads needed by Team operations, system_admin reads own Company, division_lead reads
own Division, and contextual Team Lead may read only their own Team's Division context and
eligible same-Division Members required to add/remove Members in that exact Team. This does not
grant general Division administration or all-Division browsing.

## Routes

| Method | Path | Authorization / behavior |
|---|---|---|
| POST | `/team` | system_admin own Company or scoped division_lead; `ADD_TEAM`; `{ divisionId, name, leadMemberId? }`; 201. |
| GET | `/team` | authorized scoped read; page/limit and optional scoped `divisionId`; `name asc,id asc`; 200 items/meta. |
| GET | `/team/:id` | authorized scoped read; 200 or indistinguishable 404. |
| PATCH | `/team/:id` | system_admin or scoped division_lead; `ADD_TEAM`; `{ name }`; 200. |
| DELETE | `/team/:id` | same Team-management scope; `ADD_TEAM`; guarded hard delete 204 or 409 history block. |
| PUT | `/team/:id/lead` | system_admin or scoped division_lead; `ADD_TEAM`; `{ leadMemberId }`; 200. |
| GET | `/team/:id/member` | authorized Team scope; list current and, with `includeEnded=true`, ended association history; 200. |
| POST | `/team/:id/member` | system_admin/scoped division_lead/contextual exact Team Lead; `ASSIGN_MEMBER`; `{ memberId, teamRole? }`; 201. Member may be existing or newly created by a prior separate `/member` call; this route never creates the Member. |
| DELETE | `/team/:id/member/:memberId` | same membership scope; `ASSIGN_MEMBER`; end active membership with 204, never row deletion. |

Team responses expose Team fields, safe lead summary, and membership fields (`id`, member summary,
`teamRole`, `joinedAt`, `leftAt`) where requested. DTOs reject Tenant/Company/Division changes,
isActive, timestamps, inline Member creation payloads, User/role/password fields, caller `leftAt`,
and arbitrary member ID arrays. There is no activate/deactivate endpoint.

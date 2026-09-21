# API Contract: 04.3 - Team

Base `/api/v1`; inherits platform envelopes, pagination, UUID parsing, centralized exception
mapping, and `x-request-id` behavior.

## Authorization and object scope

All routes use JWT-derived Tenant context, active session/User/ActorProfile, object scope, and
configured permissions. `system_admin` has `ADD_TEAM` for Team CRUD/lead assignment only in own
Company. `division_head` may manage Teams across own-Company Divisions according to configured
permissions and may delete any otherwise-deletable Team in those Divisions. `division_lead`
additionally needs active ActorProfile -> Member -> Division equality to the Team Division and
`ADD_TEAM`; this owner-approved rule overrides stale system-admin-only Team creation.

For membership operations, system_admin, division_head, or scoped division_lead needs
`ASSIGN_MEMBER`. A `team_lead` may perform those operations only when actor Member ID equals
`Team.leadMemberId` and `ASSIGN_MEMBER` is configured. Calls without applicable action and
object scope are 403; a role label alone never authorizes object access.

For Team reads, a system_admin and configured division_head read own Company, division_lead reads
own Division with `ADD_TEAM`, and a `team_lead` with `ASSIGN_MEMBER` may read only exact Teams
where actor Member ID equals `leadMemberId` (the list is filtered to those Teams). Other
authenticated actors receive 403 rather than a broad organization directory.

For Member reads needed by Team operations, system_admin and configured division_head read own
Company, division_lead reads own Division, and `team_lead` may read only their exact led-Team
context and eligible same-Team Members required to add/remove Members in that exact Team. This
does not grant general Division administration or all-Division browsing.

## Leadership Provisioning

Creating a leadership candidate reuses normal Member onboarding: `User -> Member`. The later
existing role-assignment/leadership workflow creates or reuses its UserRole and Member-backed
ActorProfile; Team membership itself does not assign a role. Do not create separate leader
identity models. Assignment scope is validated at assignment time:
system_admin -> own Company; division_head -> own Company / target Division; division_lead ->
own Division / target Team; team_lead -> exact Team. Role assignment alone never bypasses
object scope.

## Routes

| Method | Path | Authorization / behavior |
|---|---|---|
| POST | `/team` | system_admin own Company, division_head own Company where configured, or scoped division_lead; `ADD_TEAM`; `{ divisionId, name, leadMemberId? }`; 201. |
| GET | `/team` | authorized scoped read; page/limit and optional scoped `divisionId`; `name asc,id asc`; 200 items/meta. |
| GET | `/team/:id` | authorized scoped read; 200 or indistinguishable 404. |
| PATCH | `/team/:id` | system_admin, division_head, or scoped division_lead; `ADD_TEAM`; `{ name }`; 200. |
| DELETE | `/team/:id` | same Team-management scope; `ADD_TEAM`; guarded hard delete 204 or 409 history block. |
| PUT | `/team/:id/lead` | system_admin, division_head, or scoped division_lead; `ADD_TEAM`; `{ leadMemberId }`; 200. |
| GET | `/team/:id/member` | authorized Team scope; list current and, with `includeEnded=true`, ended association history; 200. |
| POST | `/team/:id/member` | system_admin/division_head/scoped division_lead/exact `team_lead`; `ASSIGN_MEMBER`; `{ memberId, teamRole? }`; 201. Member may be existing or newly created by a prior separate `/member` call; this route never creates the Member. |
| DELETE | `/team/:id/member/:memberId` | same membership scope; `ASSIGN_MEMBER`; ends the Member's active Team assignment with 204. The Member disappears from the active Team list, while the membership row/history remains. It does not delete the Member or change User roles or permissions. |

Team responses expose Team fields, safe lead/member summaries (`id`, `name`, `email`,
`designation`), and membership fields (`id`, member summary, `teamRole`, `joinedAt`, `leftAt`)
where requested. DTOs reject Tenant/Company/Division changes,
isActive, timestamps, inline Member creation payloads, User/role/password fields, caller `leftAt`,
and arbitrary member ID arrays. There is no activate/deactivate endpoint.

For Member summaries, `designation` is only the flat related `Designation.name` compatibility
display from 04.4; do not expose a nested Designation object or infer authority from it.

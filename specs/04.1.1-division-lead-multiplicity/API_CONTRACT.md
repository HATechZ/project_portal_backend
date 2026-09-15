# API Contract: 04.1.1 — Division Lead Multiplicity

Base: `/api/v1`. Inherits platform envelopes, pagination, validation, UUID parsing, exception
mapping, and `x-request-id` behavior from `00-platform-core`. States only its **deviations**
from `04.1-division`'s contract ([Art. III](../rules/03-contracts.md)).

## Authorization

Guard ordering is unchanged:
`AccessTokenGuard -> TenantContextGuard -> AuthenticationGuard -> ObjectScopeGuard ->
SystemAdminGuard -> PermissionsGuard`.

**Deviation from `04.1`:** the lead routes are not `system_admin`-only. `division_head` may
assign and revoke Leads within its own Company (SPEC DR-12), so `SystemAdminGuard` is replaced
on these two routes by a same-Company check admitting `system_admin` and `division_head`. The
required permission is `WorkflowActionCode.ASSIGN_LEADER`, not `ADD_DIVISION`.

> `ASSIGN_LEADER` already exists and needs no owner action. It is in the
> `WorkflowActionCode` enum, seeded as an assignment action in
> `prisma/seed/data/permissions.data.ts`, and already granted to `division_head` both there
> and in the applied `20260910163000_align_company_signup_role_bootstrap` migration.
> `system_admin` holds every action except `DECIDE_BID_OUTCOME`, so it holds this one too.
> An earlier draft of this contract invented a separate `ASSIGN_DIVISION_LEAD` code; that
> was a duplicate of this one and was withdrawn 2026-09-15 before any migration was written.

`division_lead` and `team_lead` may not assign or revoke Leads. Caller Tenant/Company IDs or
headers carry no authority.

## Routes and DTOs

| Method | Path | Behavior |
|---|---|---|
| PUT | `/division/:id/lead` | **Changed.** Assign from `{ memberId }`; 200. The Member must be same-Tenant/Company and User-linked, but **need not belong to this Division**. Revokes the incumbent Lead in the same transaction. Idempotent when the Member is already the active Lead. |
| DELETE | `/division/:id/lead` | **New.** Revoke the current active Lead; 204. Sets `revokedAt`; deletes no row. 404 when the Division has no active Lead. |
| GET | `/division/:id/lead` | **New.** Current active Lead for the Division; 200, or `data: null` when Lead-less. Not a 404 — a Lead-less Division is valid (SPEC DR-10). |
| GET | `/member/:id/divisions` | **New.** Divisions the Member actively leads; 200 `{ items, meta }`, order `name asc, id asc`. Empty array when the Member leads none. |

`POST/GET/PATCH/DELETE /division` are unchanged by this module, except that
`DELETE /division/:id` gains a sixth dependency blocker (SPEC DR-11): a Division with any
`division_leads` row — active or revoked — returns 409.

## Response shape

The assign response keeps its current fields — Division summary, assigned Member identity,
`division_lead` role state, ActorProfile link state — and adds:

- `assignedAt`
- `revokedIncumbent`: the previous Lead's Member summary and `revokedAt`, or `null` when the
  Division had no Lead
- `idempotent`: `true` when the Member was already the active Lead and no write occurred

It exposes no password, session, or token data, and no `Division.leadMemberId` (that column
does not exist and is not introduced).

`GET /division/:id/lead` returns the Member summary, `assignedAt`, and `assignedByUserId`.
Revoked rows are never returned by any read route in this module; history is queryable only
through the database.

## Failure envelope

| Condition | HTTP | `AppErrorCode` |
|---|---:|---|
| Malformed `memberId` / `:id` UUID | 400 | `VALIDATION_FAILED` |
| Division missing or foreign | 404 | `NOT_FOUND` |
| Member missing, inactive, or outside Company | 404 | `NOT_FOUND` |
| Member has no linked User | 409 | `CONFLICT` |
| Revoke with no active Lead | 404 | `NOT_FOUND` |
| Concurrent assign racing the incumbent revoke (partial unique violation) | 409 | centralized conflict mapping |
| Missing/invalid bearer or inactive auth context | 401 | `UNAUTHORIZED` |
| Caller lacks `ASSIGN_LEADER` or acts outside own Company | 403 | `FORBIDDEN` |

The 409 on a concurrent assign is produced by the
`division_leads_one_active_per_division` partial unique index, mapped centrally by the shared
Prisma exception filter. No service catches a Prisma error (non-negotiable #5).

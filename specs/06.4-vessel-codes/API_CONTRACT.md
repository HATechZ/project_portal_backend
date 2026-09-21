# API Contract: 06.4 — Vessel Codes

Base `/api/v1`; platform envelope, Swagger, UUID parsing, validation, `x-request-id`, and safe exception mapping apply.

| Method | Path | Contract |
|---|---|---|
| GET | `/vessel-codes` | Active list; management may use strict boolean `includeInactive`; `sortOrder,name,id`. |
| GET | `/vessel-codes/deactivated` | Authorized management list of inactive Vessel rows only; `sortOrder,name,id`. |
| GET | `/vessel-codes/:id` | Same-tenant Vessel Code detail; wrong type/foreign/absent is 404. |
| POST | `/vessel-codes` | Management create `{ name, code }`; trim/uppercase code; 201. |
| PATCH | `/vessel-codes/:id` | Management update approved name/code only after referenced-edit policy is approved. |
| PATCH | `/vessel-codes/:id/deactivate` | Active → inactive; same-state request is 409. |
| PATCH | `/vessel-codes/:id/reactivate` | Inactive → active; same-state request is 409. |

Response: `id,name,code,sortOrder,isActive,createdAt,updatedAt`; no tenantId, OptionType, isDefault, or generic category input. DTO rejects tenant/type/id, sort/default/lifecycle/timestamps and relations. Management needs bearer, active TenantContext/session/actor, `UPDATE_SETTINGS`, and tenant-wide scope. Invalid input is 400; absent/foreign/wrong type 404; permission/scope 403; duplicate/lifecycle/FK/race 409; DB internals never leak.

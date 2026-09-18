# API Contract: 06.2 Ã¢â‚¬â€ POD

Base `/api/v1`; platform envelope, Swagger, UUID parsing, `x-request-id`, whitelist validation and safe centralized errors apply.

| Method | Path | Contract |
|---|---|---|
| GET | `/pod-codes` | Active list; authorized management may use strict boolean `includeInactive`; `sortOrder,name,id`. |
| GET | `/pod-codes-codes/:id` | Same-tenant POD only; absent, foreign, or wrong OptionType is 404. |
| POST | `/pod-codes` | Management create `{ name }`; 201. |
| PATCH | `/pod-codes-codes/:id` | Management identity update only when referenced-edit decision permits it. |
| PATCH | `/pod-codes-codes/:id/deactivate` | Active Ã¢â€ â€™ inactive; repeated request is 409. |
| PATCH | `/pod-codes-codes/:id/reactivate` | Inactive Ã¢â€ â€™ active; repeated request is 409. |

Response: `id,name,sortOrder,isActive,createdAt,updatedAt`; no code, tenantId, OptionType, isDefault, category input, or relations. Requests reject code, tenant/type/id, sortOrder, default, lifecycle and timestamps. Management requires bearer, active TenantContext/session/actor, `UPDATE_SETTINGS`, and tenant-wide settings scope; consumer authorization is owned by future Bid use cases. Invalid input is 400, hidden records 404, permission/scope 403, duplicate/lifecycle/FK/race 409, and unexpected storage error sanitized 500.

# API Contract: 06.1 Ã¢â‚¬â€ POL

Base `/api/v1`; platform envelopes, UUID parsing, whitelist validation, Swagger, `x-request-id`, and centralized safe errors apply.

| Method | Path | Contract |
|---|---|---|
| GET | `/pol-codes` | Active POL list by default; authorized management may request strict boolean `includeInactive`; order `sortOrder,name,id`. |
| GET | `/pol-codes/deactivated` | Authorized management list of inactive POL rows only; order `sortOrder,name,id`. |
| GET | `/pol-codes-codes/:id` | Same-tenant POL detail; wrong type/foreign/absent is 404. |
| POST | `/pol-codes` | Management create `{ name }`; 201. |
| PATCH | `/pol-codes-codes/:id` | Management update only approved identity fields after owner decision on referenced values; no type/tenant/sort/default/lifecycle fields. |
| PATCH | `/pol-codes-codes/:id/deactivate` | Active Ã¢â€ â€™ inactive; 200, or 409 if already inactive. |
| PATCH | `/pol-codes-codes/:id/reactivate` | Inactive Ã¢â€ â€™ active; 200, or 409 if already active. |

Responses contain `id`, `name`, `sortOrder`, `isActive`, `createdAt`, `updatedAt`Ã¢â‚¬â€never `code`, tenantId, OptionType, or isDefault. POST/PATCH reject `code`, type/category, tenantId, ID, sortOrder, isDefault, timestamps, and relations. All management routes require bearer, active TenantContext/session/actor, `UPDATE_SETTINGS`, and tenant-wide settings scope. Consumer-read authorization belongs to the consuming Bid operation, not a bypass.

Bad UUID/field/name/type is 400; absent/foreign/wrong type 404; permission/scope 403; duplicates, lifecycle state, FK and DB race 409; unknown DB faults are sanitized 500.

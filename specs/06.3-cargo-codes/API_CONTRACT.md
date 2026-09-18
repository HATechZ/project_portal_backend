# API Contract: 06.3 — Cargo Codes

Base `/api/v1`; platform envelope, Swagger, UUID parsing, validation, `x-request-id`, and centralized safe errors apply.

| Method | Path | Contract |
|---|---|---|
| GET | `/cargo-codes` | Active list; management may use strict boolean `includeInactive`; order `sortOrder,name,id`. |
| GET | `/cargo-codes/:id` | Same-tenant Cargo Code detail only; wrong type/foreign/absent is 404. |
| POST | `/cargo-codes` | Management create `{ name, code }`; code trims and uppercases; 201. |
| PATCH | `/cargo-codes/:id` | Management update approved name/code only when referenced-edit decision permits it. |
| PATCH | `/cargo-codes/:id/deactivate` | Active → inactive; repeated state is 409. |
| PATCH | `/cargo-codes/:id/reactivate` | Inactive → active; repeated state is 409. |

Response is `id,name,code,sortOrder,isActive,createdAt,updatedAt`; never tenantId, OptionType, isDefault, or a caller-supplied category. DTO rejects type/category, tenantId, ID, sortOrder, default, lifecycle, timestamps and relations. Management requires bearer, active TenantContext/session/actor, `UPDATE_SETTINGS`, and tenant-wide scope. Invalid name/code/UUID is 400; hidden records 404; permission/scope 403; normalized duplicate, lifecycle, FK or DB race 409; internals are sanitized 500.

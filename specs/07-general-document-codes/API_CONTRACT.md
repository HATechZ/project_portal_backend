# API Contract: 07 — General Document Codes

Base is `/api/v1/general-document-codes`. Platform envelopes, UUID parsing, whitelist validation, `x-request-id`, centralized `AppException`, and `ApiStandard*Response` apply. Response fields are `id`, `code`, `name`, `description`, `sortOrder`, `isActive`, `createdAt`, and `updatedAt`; never `tenantId` or `documentGroup`.

Every route requires the standard authenticated active TenantContext/actor guard chain and the controller-wide `MANAGE_GENERAL_DOCUMENT_CODES` permission. It is granted only to the current `system_admin` runtime role, `division_head`, and `division_lead`; role identity is never checked directly, and custom roles receive no grant. The module uses no Module 06 `tenantWide` service restriction: a current TenantContext plus the configured permission is sufficient for those approved roles.

| Method | Path | Exact Swagger summary | Behavior |
|---|---|---|---|
| GET | `/general-document-codes?status=active\|inactive\|all` | List all General Document Codes | Same-tenant fixed-group list ordered `sortOrder ASC, code ASC, id ASC`; `status=active` is the default. |
| GET | `/general-document-codes/deactivated` | List deactivated General Document Codes | Same-tenant fixed-group list of inactive rows only, ordered `sortOrder ASC, code ASC, id ASC`. |
| GET | `/general-document-codes/:id` | Get General Document Code by ID | Same tenant/fixed group only; foreign, wrong-group, or absent is 404. |
| POST | `/general-document-codes` | Create a new General Document Code | 201; body `{ code, name, description? }`; active on creation. |
| PATCH | `/general-document-codes/:id` | Update General Document Code by ID | 200; code, name, and description are mutable, including when referenced by Documents. |
| PATCH | `/general-document-codes/:id/deactivate` | Deactivate General Document Code by ID | Active → inactive, 200; already inactive is 409. |
| PATCH | `/general-document-codes/:id/reactivate` | Reactivate General Document Code by ID | Inactive → active, 200; already active is 409. |

Each `:id` has parameter name `id` and description `General Document Code DocumentCodeOption ID`, plus standard unauthorized, forbidden, bad-request, not-found, conflict, and safe-server-error decorators. No DELETE exists.

`code` and `name` are required strings limited by existing storage (20/180); `description` is optional text. Code trims surrounding whitespace then uppercases while preserving its string form and leading zeroes: `" abc "` becomes `"ABC"`; `"001"` remains `"001"`. Name trims and must be non-empty. `sortOrder` is not client-mutable and V1 has no reorder API. Reject `tenantId`, `documentGroup`, `id`, `sortOrder`, `isActive`, timestamps, default markers, and relations. Tenant comes from context; persistence fixes `MARKETING`. Duplicate/race mapping is 409 under normalized `(tenantId, documentGroup, code)`; name is not unique. 400 covers invalid body, UUID, or status; 401 auth/actor; 403 TenantContext/permission; 404 isolation; 409 duplicate or lifecycle state; 500 sanitized faults.

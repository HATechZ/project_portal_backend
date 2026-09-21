# API Contract: 04.4 — Designation

Base: `/api/v1`. The exact project plural convention is used: `/designations`. All responses use
the platform envelope, UUID parsing, centralized exception mapping, Swagger decorators, and
`x-request-id` behavior.

## Guards and authorization

Every route requires `AccessTokenGuard -> TenantContextGuard -> AuthenticationGuard` and the
ordinary active-context path. The two GET routes use only that authenticated same-Tenant boundary
and a tenant-scoped repository; they do **not** require `MANAGE_DESIGNATIONS`. Mutation routes
also use the established `ObjectScopeGuard -> PermissionsGuard` pattern and require
`WorkflowActionCode.MANAGE_DESIGNATIONS` method-by-method. Permission provisioning, rather than
controller/service role branches, grants it only to `system_admin` and `division_head`.

| Method | Path | Input / behavior |
|---|---|---|
| GET | `/designations` | Authenticated active same-Tenant list; `page`/`limit`, `name asc, id asc`; 200 items/meta. |
| GET | `/designations/:id` | Authenticated active same-Tenant detail; 200 or indistinguishable 404. |
| POST | `/designations` | `MANAGE_DESIGNATIONS`; `{ name }`; 201. |
| PATCH | `/designations/:id` | `MANAGE_DESIGNATIONS`; `{ name? }`, at least one defined; 200. |
| DELETE | `/designations/:id` | `MANAGE_DESIGNATIONS`; hard delete only when unreferenced; 204, otherwise 409. |

`name` is a required 1–140 character string after trimming on create. Update trims an included
name and rejects blank/null/empty or undeclared input. DTOs never accept `id`, `tenantId`,
`companyId`, `designationId`, timestamps, `isActive`, role, permission, or workflow fields.

The response is exactly `id`, `name`, `createdAt`, and `updatedAt`. It does not expose ownership
override fields or unnecessary nested data. Invalid input is 400; missing/foreign is 404;
authentication/context failure is 401; missing mutation permission is 403; normalized duplicate,
referenced delete, and database races are 409.

The intended Member UI flow is `GET /api/v1/designations`, render names in a dropdown, and submit
the selected `designationId` to Member create/update. No hard-coded designation list is part of
the backend/frontend contract.

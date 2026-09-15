# API Contract: 04 — Organization

Base: `/api/v1`. Completion tracking: `../INDEX.md`.

## Authentication and envelopes

Company list/detail/update are same-Tenant system_admin only. Controller guard order:
AccessTokenGuard -> TenantContextGuard -> AuthenticationGuard -> ObjectScopeGuard ->
SystemAdminGuard -> PermissionsGuard. No additional workflow action permission is required.
Bearer JWT establishes Tenant context; no frontend x-tenant-id is required or trusted.
Missing/invalid credentials return 401; authenticated non-admin returns 403.

Current platform success shape is `{ success: true, message, data, timestamp }`.
Errors are `{ success: false, error: { code, message, details? }, meta: { requestId, timestamp } }`.
Responses echo `x-request-id`. DTO/UUID errors use VALIDATION_FAILED or BAD_REQUEST;
authorization errors use UNAUTHORIZED/FORBIDDEN; missing resources use NOT_FOUND;
constraint/concurrency errors use the existing centralized mapping (409).

## GET /api/v1/company-type

Public global reference data. Returns 200 with data array of `{ id, name, description }`;
description is nullable. Ordered name asc, id asc. No pagination or Tenant header.

## POST /api/v1/company/signup

Public sole Company creation route; atomically provisions an internal Tenant and Company.

```json
{
  "company": { "name": "Example Company", "abbr": "EX", "companyTypeId": "20000000-0000-4000-8000-000000000001" },
  "admin": {
    "fullName": "Example Admin", "email": "admin@example.com",
    "password": "SecurePassword123", "confirmPassword": "SecurePassword123",
    "country": "Bangladesh", "phone": "+88012345678"
  },
  "termsAccepted": true
}
```

Both nested objects are required and non-null, non-array objects. Their omission/null/invalid
shape returns 400 before hashing/provisioning. Company name is trimmed, 1–180 characters;
abbr is trimmed, 1–30; CompanyType is a required existing UUID. Admin fullName is trimmed,
1–160; email is normalized lowercase/trimmed, valid and at most 255; country is trimmed,
1–100; phone is trimmed, 1–60. Password remains 8–72 bytes. Confirmation is required and must
match exactly, with no trimming. It is validation-only and never passed to persistence.
Only password is hashed. Terms must be boolean true. Undeclared fields are rejected.

201 data:
- company: id, name, abbr, companyTypeId, workspaceSlug.
- admin: id, fullName, email, country, phone.

No password/hash/confirmation/internal Tenant is returned. Slug is internally generated,
globally unique and immutable, and is not a login credential. Email-only login is unchanged.
Invalid input/unknown type returns 400; duplicate normalized administrator email returns 409.
A provisioning failure rolls back the complete workspace.

## GET /api/v1/company

Shared PaginationQueryDto page/limit; returns 200 with `{ items: Company[], meta }` in data.
Order is name asc, id asc. A Tenant has at most one Company; later pages may be empty.
Invalid pagination returns 400. Results never include another Tenant's Company.

## GET /api/v1/company/:id

UUID path validated before queries. Returns 200 Company; malformed UUID returns 400;
missing or foreign Company returns indistinguishable 404 naming the requested ID.

Company response: id, name, abbr, workspaceSlug, companyTypeId (nullable for legacy rows),
companyType (nullable object with id/name/description), isActive, createdAt, updatedAt.

## PATCH /api/v1/company/:id

Same-Tenant system_admin only. Body accepts optional name (trimmed, 1–180) and companyTypeId
(existing UUID). At least one is required. Null, unknown and immutable fields return 400.
Only supplied fields change, plus updatedAt. Abbreviation, workspaceSlug, Tenant, IDs and
activation cannot be changed. Unknown Company is checked before type existence.

200 returns Company. Malformed ID, empty/invalid body or unknown type returns 400; missing or
foreign Company returns 404. Shared FK/concurrency failures return 409. Same-field concurrent
updates use last committed write wins; omitted fields are not overwritten.

## Retired and deferred

POST /api/v1/company is retired and returns 404; it cannot create a second Company.
Company deactivate/delete remains unapproved. Division, Member, and Team routes are approved
targets specified only by `04.1-division`, `04.2-member`, and `04.3-team`; none is implemented
by this Company module. Team membership routes belong to `04.3-team`, not a separate module.
Member creation and Team assignment remain separate operations, even when a product flow performs
them sequentially.

## Runtime prerequisite

The configured database currently lacks app_user UPDATE on public.companies. Until the owner
applies that existing-table privilege, valid PATCH returns 500 rather than the required 200.
This is a tracked blocker, not the approved API behavior. No grants or migrations were applied.

# API Contract: 04 — Organization

**Status:** Shipped (retro-spec) · **Base:** `/api/v1`

Tenant-scoped Company reads sit behind the full guard chain, applied at their controller:
`TenantContextGuard → AccessTokenGuard → AuthenticationGuard → ObjectScopeGuard →
SystemAdminGuard → PermissionsGuard`. CompanyType reference reads and Company signup are
public because both are needed before a workspace or administrator exists. All responses are wrapped by the platform envelope
([00](../00-platform-core/SPEC.md)); the shapes below are the `data` member.

---

## `GET /company-type`

Global reference data — not tenant-filtered (DR-02). Unpaginated: the list is short, fixed, and
seeded.

```jsonc
[{ "id": "uuid", "name": "Engineering Consultant", "description": "string | null" }]
```

| Code | When |
|---|---|
| 200 | always, possibly an empty array |

---

## `POST /company/signup`

Public **Create Company Account** operation. It accepts no Tenant header and provisions the
complete workspace atomically.

```jsonc
{
  "company": {
    "name": "Tech Marine Solutions Ltd",
    "abbr": "TMS",
    "companyTypeId": "uuid"
  },
  "admin": {
    "fullName": "Nayeem Rahman",
    "email": "nayeem@techmarine.com",
    "password": "SecurePassword123",
    "country": "Bangladesh",
    "phone": "+880 1711-234567"
  },
  "termsAccepted": true
}
```

`confirmPassword`, Tenant identifiers, roles, permissions, and ActorProfile fields are not DTO
properties and are rejected by the global whitelist. NestJS hashes the password and passes only
the hash to the database function.

The response exposes Company and administrator account data, not the internal Tenant. Unknown
CompanyType and validation failures are 400. Any provisioning failure rolls back the entire
operation.

---

## Retired: `POST /company`

This route is removed because a Tenant cannot own a second Company. It is not redirected or
reinterpreted as signup. The historical contract below is retained only as change history.

Requires `ADD_COMPANY`.

```jsonc
// request
{
  "name": "Haque & Sons Ltd.",   // 1..180, trimmed
  "abbr": "HSL",                 // 1..30, trimmed, unique per tenant
  "companyTypeId": "uuid | null" // optional
}
```

```jsonc
// 201
{
  "id": "uuid",
  "name": "Haque & Sons Ltd.",
  "abbr": "HSL",
  "companyTypeId": "uuid | null",
  "companyType": { "id": "uuid", "name": "string", "description": "string | null" },
  "isActive": true,
  "createdAt": "2026-08-28T10:00:00.000Z",
  "updatedAt": "2026-08-28T10:00:00.000Z"
}
```

| Code | When |
|---|---|
| 201 | created |
| 400 | validation failed, or `companyTypeId` does not exist |
| 403 | caller lacks `ADD_COMPANY` |
| 409 | abbreviation already used in this tenant |

`isActive` is always `true` on create — the field is written by the repository, not the client,
and no endpoint flips it.

---

## `GET /company`

Paginated per the platform contract; ordered `name asc, id asc` so the order is total and paging
is stable.

| Query | Meaning |
|---|---|
| `page`, `limit` | `PaginationQueryDto` (00) |

| Code | When |
|---|---|
| 200 | always, possibly an empty page |

---

## `GET /company/:id`

`:id` is `ParseUUIDPipe`-validated, so a malformed id is 400 before any query runs.

| Code | When |
|---|---|
| 200 | found within the caller's tenant |
| 400 | `:id` is not a uuid |
| 404 | no such company **in this tenant** — indistinguishable from another tenant's company, which is intended |

---

## Not exposed

No `PATCH`, `PUT`, or `DELETE`. A company cannot currently be renamed, retyped, or deactivated
through the API; changing one requires a database write. Recorded in `SPEC.md` under known
deviations rather than treated as a decision.

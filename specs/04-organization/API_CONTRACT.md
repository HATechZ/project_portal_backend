# API Contract: 04 — Organization

**Status:** Shipped (retro-spec) · **Base:** `/api/v1`

Every route sits behind the full guard chain, applied at the controller:
`TenantContextGuard → AccessTokenGuard → AuthenticationGuard → ObjectScopeGuard →
SystemAdminGuard → PermissionsGuard`. All responses are wrapped by the platform envelope
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
| 401 | no tenant context, or no valid access token |

---

## `POST /company`

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

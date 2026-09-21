# SPEC: 04.4 — Designation

**Status:** Gate 3 · approved target · not implemented  
**Tables owned:** proposed `designations`; consumes `members` from 04.2  
**Dependencies:** 04.2 Member and 03 Identity & Access permission catalog

## 1. Overview & intent

Designation is tenant/company-owned master data for **internal Members**. It replaces the
future use of a hard-coded or free-text Member designation. It is business data only: it does
not grant an ActorRole/UserRole, permission, Division/Team authority, or workflow authority.

The current backend persists the legacy Member free-text `roleTitle`; it does not yet contain a
Designation module or relation. This is an approved target and every implementation task remains
unticked.

## 2. Domain rules

| # | Rule | Enforced by |
|---|---|---|
| DR-01 | A Designation belongs to the authenticated Tenant and scoped Company. Those values are never request input. | TenantContext, scoped repository, RLS, composite FK/unique backstops |
| DR-02 | `name` is required, trimmed, and case-insensitively unique within `(tenantId, companyId)`. Another Tenant/Company may reuse it. | DTO/service duplicate check and normalized DB unique index |
| DR-03 | Create, update, and delete require `MANAGE_DESIGNATIONS`; it is granted only to `system_admin` (the current runtime Tenant System Admin equivalent) and `division_head`. No direct role check occurs in controller/service. | permission guard and provisioned system-role grants |
| DR-04 | Any authenticated active same-Tenant user with TenantContext may list or view a Designation. Reads do not require `MANAGE_DESIGNATIONS`. | authentication/context/scoped repository |
| DR-05 | An internal Member persists `designationId`, not arbitrary designation text. The referenced Designation must be in that Member's current Tenant/Company. | DTO/service validation and composite FK |
| DR-06 | A referenced Designation cannot be deleted. Delete returns 409, changes neither Designation nor Members, and the restrictive FK is the race backstop. | dependency probe and restrictive FK |
| DR-07 | ClientContact designation remains independent external-contact free text and is not related to this module. | module boundary |

## 3. EARS acceptance criteria

- `[AC-E01]` WHEN an authorized manager creates or renames a valid Designation, THEN the system
  SHALL trim the name and reject a normalized duplicate in that Tenant/Company with 409.
- `[AC-E02]` WHEN an authenticated active same-Tenant user requests the list or a visible ID,
  THEN the system SHALL return only current-Tenant records without requiring the management action.
- `[AC-E03]` WHEN an internal Member is created or updated with `designationId`, THEN the system
  SHALL require the referenced current-Tenant/current-Company Designation and return its display
  name only in the compatibility `designation` response field.
- `[AC-W01]` IF any Member references a Designation, THEN DELETE SHALL return 409 and SHALL not
  detach, rename, deactivate, or otherwise alter either record.
- `[AC-W02]` IF legacy Member designation data is blank or otherwise unmappable during migration,
  THEN preflight SHALL stop and report it; it SHALL not invent a placeholder or discard the value.

## 4. Failure modes

| Condition | HTTP |
|---|---:|
| Invalid UUID/body, absent or blank trimmed name, empty PATCH, forbidden ownership/system fields | 400 |
| Missing or foreign Designation | 404 |
| Missing/invalid bearer, inactive user/session/Tenant context | 401 |
| Authenticated caller lacks `MANAGE_DESIGNATIONS` for mutation | 403 |
| Normalized duplicate, referenced delete, FK/unique/serialization race | 409 |

## 5. Out of scope

No deactivate/reactivate lifecycle, ordering, hard-coded catalogue, global uniqueness, ClientContact
change, role/permission assignment, or workflow authority is approved. Runtime code, Prisma,
migrations, seeds, grants, and database changes are not made by this specification task.

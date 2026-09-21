# Data Contract: 04.4 — Designation

## Proposed structural contract

This is a forward design, not an applied schema change. Add tenant/company-owned
`designations` with only `tenantId`, UUID `id`, `companyId`, `name varchar(140)`, `createdAt`, and
`updatedAt`. It has restrictive Tenant and Company FKs, tenant/company indexes, and composite
unique `(id, tenantId, companyId)` for tenant-carrying references.

The database race backstop is a normalized unique index on
`(tenant_id, company_id, lower(btrim(name)))`. Service checks use the same trimmed,
case-insensitive comparison and translate duplicates to 409. The stored spelling is the trimmed
caller value; it is not globally unique.

`Member.designationId` becomes the source-of-truth relation. The final relation is composite:
`(designationId, tenantId, companyId) -> designations(id, tenantId, companyId)` with `ON DELETE
RESTRICT`. The relation protects cross-tenant/company assignment and referenced deletes even
under races. Final Member `designationId` is non-null. Member response adds `designationId`; the
existing flat `designation` display field may be the joined `Designation.name`, with no nested
Designation object. ClientContact.designation remains a separate nullable free-text field and is
not migrated or related.

## Forward migration and legacy conversion plan

1. Create Designation storage, tenant RLS policy, restrictive FKs, normalized unique index, and
   narrow `app_user` `SELECT, INSERT, UPDATE, DELETE` privileges; retain RLS and grant neither
   `ALL` nor `BYPASSRLS`.
2. Add nullable `members.designation_id` and the tenant/company composite relation before making
   it required.
3. Preflight every Tenant/Company legacy `members.roleTitle` value. Trim it and group non-empty
   values by `lower(trim(value))`; report and stop for null/blank/invalid values that would leave a
   required Member unmapped.
4. Per Tenant/Company, create exactly one Designation per normalized legacy value, retaining a
   sensible existing trimmed display spelling (the deterministic first existing spelling is
   acceptable), then map every matching Member in the same transaction/batch.
5. Recheck that every required Member has a same-Tenant/company Designation, and that no
   normalized duplicate exists. Only then make `designationId` non-null and retire/remove
   `roleTitle` persistence and free-text DTO support.

The preflight/backfill is tenant-safe, repeatable, and idempotent: existing matching
Designations are reused and matching Members are not remapped unnecessarily. It never deletes
Members, alters security roles/authority, invents placeholders, or silently discards legacy data.

## Division normalized-name correction

Division name storage remains `varchar(180)`, but final uniqueness is per `(tenantId, companyId,
lower(btrim(name)))`. Create/update trim names, duplicate-check with the current Division excluded
on update, and return 409. Before its unique index is added, a migration preflight must detect and
report existing normalized duplicates; it must not merge, delete, or rename Divisions. The same
tenant RLS and ordinary app_user UnitOfWork conventions remain mandatory.

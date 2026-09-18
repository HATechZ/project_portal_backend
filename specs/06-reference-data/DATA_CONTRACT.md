# Data Contract: 06 — Reference Data Domain

Shared persistence authority is `OptionType -> OptionValue`. `OptionType` is global (`id`, unique enum `code`, `name`, `description`, `isActive`); `OptionValue` is tenant-owned (`tenantId`, `id`, `optionTypeId`, `name varchar(180)`, nullable `code varchar(40)`, `sortOrder`, `isDefault`, `isActive`, timestamps). No `pols`, `pods`, `cargo_codes`, or `vessel_codes` table is approved.

Current migration history does **not** enable RLS on global `option_types`; application runtime must retain safe read access to this fixed catalogue, while these modules must not create arbitrary types. Current migration enables tenant RLS and an `app_user FOR ALL` policy on tenant-owned `option_values`. Enabling RLS on OptionType is **OPTIONAL / FUTURE SECURITY HARDENING**, not a current implementation gap. Child contracts record category uniqueness gaps.

## Required global OptionType metadata — prepared, not applied

`prisma/migrations/20260916000005_provision_option_types/migration.sql` prepares idempotent global metadata provisioning by unique `OptionType.code` for `POL`, `POD`, `CARGO_CODE`, `VESSEL_CODE`, `PROJECT_INFO_CATEGORY`, `WORK_REQUEST_TYPE`, `DOCUMENT_CATEGORY`, and `ATTACHMENT_CATEGORY`. These rows are required before the fixed-type repositories can operate. They are not tenant-owned, are not subject to new RLS behavior, and the prepared migration does not overwrite an existing code row.

It does not create any `OptionValue` row. POL/POD/Cargo/Vessel business catalogues remain tenant-owned and empty until authorized management creates values. The migration is prepared only; owner application and runtime verification remain pending.

## Runtime table privileges — prepared, not applied

`prisma/migrations/20260916000006_grant_option_value_runtime_access/migration.sql` corrects the verified `42501 permission denied for table option_types` runtime defect without changing RLS: it grants `app_user` `SELECT` on global `option_types`, `SELECT, INSERT, UPDATE` on tenant-RLS `option_values`, and `SELECT` on tenant-RLS `bid_details` for the temporary historical-safety reference check. These are the exact table privileges required by current Module 06 repository paths; tenant RLS remains mandatory for tenant-owned tables.

## Normalized uniqueness migration — prepared, not applied

`prisma/migrations/20260916000004_add_option_value_normalized_uniqueness/migration.sql` is a forward-only prepared migration. It preserves raw `(tenant_id, option_type_id, name)` uniqueness and adds these PostgreSQL expression indexes:

- `option_values_tenant_type_normalized_name_unique`: `(tenant_id, option_type_id, lower(btrim(name)))`.
- `option_values_tenant_type_normalized_code_unique`: `(tenant_id, option_type_id, upper(btrim(code))) WHERE code IS NOT NULL`.

They provide the required race-safe normalized name backstop for POL/POD/Cargo/Vessel and normalized code backstop for Cargo/Vessel, while keeping equivalent values valid across different tenants and OptionTypes. Null POL/POD codes are excluded. The migration has **not** been applied or runtime-verified.

This is intentional shared persistence behavior: any future OptionType storing an `OptionValue.name` inherits normalized-name uniqueness within its tenant and type; a future type storing a non-null `OptionValue.code` also inherits normalized-code uniqueness within its tenant and type.

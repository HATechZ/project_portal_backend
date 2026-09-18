# Data Contract: 06.2 Ã¢â‚¬â€ POD

Fixed global `OptionType.code = POD` maps to tenant `OptionValue`: tenant ID, UUID, type ID, `name varchar(180)`, nullable `code` kept null, `sortOrder` default 0, retained/deferred `isDefault`, active flag and timestamps. The repository must predicate tenant + POD type + ID; existing OptionValue tenant RLS is defense in depth.

**Current:** raw `(tenantId, optionTypeId, name)` uniqueness; normalized uniqueness awaits owner application. **Prepared:** `20260916000004_add_option_value_normalized_uniqueness` adds `(tenant_id, option_type_id, lower(btrim(name)))` without replacing raw uniqueness. It is unapplied; runtime DB verification is pending.

`BidDetail.podOptionId` is nullable `ON DELETE SET NULL` and has no POD snapshot. Normal delete is prohibited; referenced identity policy remains unresolved. `option_values` has app_user tenant RLS. Migration history does not enable RLS on global `option_types`; runtime must safely read the fixed POD catalogue and must not create arbitrary types. OptionType RLS is optional future security hardening, not a current gap.

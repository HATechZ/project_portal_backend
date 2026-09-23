# Data Contract: 06.3 — Cargo Codes

Fixed global `OptionType.code = CARGO_CODE` maps to tenant `OptionValue`: tenant ID, UUID, type ID, `name varchar(180)`, required public `code varchar(40)`, sort order, deferred `isDefault`, active status and timestamps. Repositories predicate tenant + fixed type + ID and rely on OptionValue tenant RLS as a backstop.

**Current:** raw unique `(tenantId, optionTypeId, name)` and non-unique index `(optionTypeId, code)`; normalized uniqueness awaits owner application. **Prepared:** `20260916000004_add_option_value_normalized_uniqueness` adds tenant/type-scoped `lower(btrim(name))` and non-null `upper(btrim(code))` unique indexes without deleting or rewriting data. It remains unapplied and runtime DB verification is pending.

`BidDetail.cargoId` is nullable `ON DELETE SET NULL`; it contains `cargoName` but no Cargo-code snapshot. No normal delete is safe; identity edit after reference is owner-decided. Existing `option_values` RLS is tenant-scoped. Migration history does not enable RLS on global `option_types`; runtime must safely read fixed Cargo Code catalogue entries and not create arbitrary types. OptionType RLS is optional future security hardening, not a current gap.

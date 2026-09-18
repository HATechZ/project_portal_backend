# Data Contract: 06.4 — Vessel Codes

Fixed global `OptionType.code = VESSEL_CODE` maps to tenant `OptionValue`: tenant ID, UUID, option type ID, `name varchar(180)`, public required `code varchar(40)`, sort order, retained/deferred default flag, active flag and timestamps. Repository filters require tenant + fixed type + ID, with OptionValue tenant RLS defense.

**Current:** raw unique `(tenantId, optionTypeId, name)` and non-unique `(optionTypeId, code)` index; normalized uniqueness awaits owner application. **Prepared:** `20260916000004_add_option_value_normalized_uniqueness` adds independent tenant/type-scoped normalized name and non-null normalized code unique indexes. It is not applied and runtime DB verification remains pending.

`BidDetail.vesselCodeOptionId` is nullable `ON DELETE SET NULL`; `vesselName` exists but no vessel-code snapshot does. Normal delete is prohibited; reference identity edits remain undecided. OptionValue RLS is tenant-scoped. Migration history does not enable RLS on global `option_types`; runtime must safely read fixed Vessel Code catalogue entries and not create arbitrary types. OptionType RLS is optional future security hardening, not a current gap.

# Data Contract: 06.1 Ã¢â‚¬â€ POL

`OptionType` is global and must resolve fixed code `POL`; `OptionValue` holds POL rows with `tenantId`, `optionTypeId`, required `name varchar(180)`, nullable `code` kept null, `sortOrder` default 0, `isDefault` retained/deferred, lifecycle and timestamps. Repositories must constrain `tenantId + optionTypeId(POL) + id`; OptionValue tenant RLS is the second defense.

**Current:** raw unique `(tenantId, optionTypeId, name)`; normalized uniqueness awaits owner application. **Prepared:** `20260916000004_add_option_value_normalized_uniqueness` adds the concurrent-safe `(tenant_id, option_type_id, lower(btrim(name)))` backstop without removing raw uniqueness. It remains unapplied and runtime DB verification is pending.

`BidDetail.polId` is nullable and its FK is `ON DELETE SET NULL`; its scalar model has no POL-name snapshot. Thus normal deletion is prohibited and referenced identity edit remains an owner decision. Current migration enables tenant RLS for `option_values`; migration history does not enable RLS on global `option_types`. Runtime must safely read fixed POL catalogue entries without allowing arbitrary OptionType creation. OptionType RLS is optional future security hardening, not a current gap.

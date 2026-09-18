# Plan: 06 — Reference Data Domain

1. Implement the four child feature modules as independent controllers/services/use cases.
2. Reuse a narrow shared OptionValue persistence layer; every operation constrains tenant, fixed OptionType, and ID where applicable.
3. Prepare and owner-apply `20260916000004_add_option_value_normalized_uniqueness`, which preserves raw uniqueness and adds tenant/type-scoped normalized name plus non-null normalized code backstops. Also owner-apply `20260916000005_provision_option_types` to provide the eight required global OptionType rows, then `20260916000006_grant_option_value_runtime_access` for the exact app-user table privileges those repositories require. Runtime DB verification remains pending; retain safe runtime reads of the fixed global OptionType catalogue. OptionType RLS hardening is optional future security work, not a prerequisite.
4. Keep Bid/Naming and catalogue population separate.

# Plan: 06.3 — Cargo Codes

1. Confirm safe runtime reads of fixed Cargo OptionType entries and normalized name/code DB prerequisites; OptionType RLS hardening is optional, not a prerequisite.
2. Build `CargoCodeModule` with fixed type, shared persistence and separate domain validation.
3. Add six dedicated routes and name/code DTO/mapper; no public type parameter or delete.
4. Test empty state, create/get/list/update decision boundary, code uppercase, duplicate name/code, lifecycle, inactive filtering, deterministic order, cross-type/tenant 404, UPDATE_SETTINGS/scope and no wildcard.
5. Run DB/RLS walkthrough and independent SDD after approved prerequisites.

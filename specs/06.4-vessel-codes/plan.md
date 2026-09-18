# Plan: 06.4 — Vessel Codes

1. Confirm safe runtime reads of fixed Vessel OptionType entries and normalized name/code database gaps; OptionType RLS hardening is optional, not a prerequisite.
2. Build `VesselCodeModule` with separate API/domain rules and shared fixed-type persistence.
3. Add six dedicated routes, DTOs and mapper; no public category selector or delete.
4. Test empty state, create/list/get/update decision boundary, trim/uppercase code, duplicate name/code, lifecycle, ordering, active filtering, cross-type/tenant 404, UPDATE_SETTINGS/scope and no wildcard.
5. Complete approved DB/RLS walkthrough and independent SDD.

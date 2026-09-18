# Plan: 06.1 Ã¢â‚¬â€ POL

1. Confirm safe runtime reads of fixed POL OptionType entries and the normalized-name migration prerequisite; OptionType RLS hardening is optional, not a prerequisite.
2. Build dedicated `PolCodeModule` API/use cases over shared OptionValue repository constrained to POL.
3. Add name-only DTO/mapper and six dedicated routes; no generic category input or delete.
4. Enforce TenantContext, `UPDATE_SETTINGS`, tenant-wide scope, type isolation and lifecycle.
5. Test empty list, CRUD lifecycle, inactive management/selection filtering, normalized duplicate, ordering, cross-type/cross-tenant 404, permission denial/no wildcard, and no data defaults.
6. Verify spec, focused tests, RLS walkthrough, and independent SDD.

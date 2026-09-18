# Plan: 06.2 Ã¢â‚¬â€ POD

1. Confirm safe runtime reads of fixed POD catalogue entries and the normalized-name DB prerequisite; OptionType RLS hardening is optional, not a prerequisite.
2. Build `PodCodeModule` over shared persistence fixed to POD, never generic category routes.
3. Add six name-only routes, mapper, DTOs, auth/scope and lifecycle.
4. Prove empty/list/get/create/update decision boundary/deactivate/reactivate, ordering, normalized duplicates, type/tenant isolation, inactive filtering, no wildcard and no hard delete.
5. Complete runtime RLS walkthrough and independent SDD after prerequisites.

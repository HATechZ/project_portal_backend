# SPEC: 06 — Reference Data Domain

**Status:** umbrella only; executable feature specifications are 06.1–06.4.  
**Persistence:** shared `OptionType -> OptionValue`; no category tables.

## Boundary

Reference Data is a domain grouping, not a public generic CRUD API. POL, POD, Cargo Code, and Vessel Code are separate feature/API modules: [06.1](../06.1-pol/), [06.2](../06.2-pod/), [06.3](../06.3-cargo-codes/), and [06.4](../06.4-vessel-codes/). Each fixes its own `OptionTypeCode`; shared repository, tenant/UoW, lifecycle, normalization, exception mapping, permission, and RLS infrastructure must not collapse their business APIs into `/reference-data/:category`.

This umbrella owns no endpoint, runtime module, seed, migration, RLS change, permission change, Bid, Project Code, filename, or generic OptionType CRUD. Every category may initially be empty.

## Shared invariants

- `OptionType` is the fixed global category catalogue; `OptionValue` is tenant-owned.
- Ownership derives from authenticated TenantContext, never a request body.
- Values order by `sortOrder ASC, name ASC, id ASC`; normal selection is active-only. Deactivate/reactivate preserves rows and historical FKs; no normal delete.
- Identity edits after a reference is used are **OWNER DECISION REQUIRED**. `sortOrder` mutation is unresolved; `isDefault` management is deferred.
- Reference modules supply values only. Bid/Project/Naming owns selection validation, snapshots, `SKM` generation, and filenames. Future custom Cargo/Vessel Bid entry and catalogue population are **OWNER DECISION REQUIRED**.

## Definition of Done

The four child specifications pass Gates 1–3. Runtime work must first resolve documented normalized-uniqueness prerequisites and retain safe reads of the fixed OptionType catalogue; it must add no catalogue values unless separately authorized. OptionType RLS hardening is optional future security work.

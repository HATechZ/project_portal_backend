# SPEC: 06.4 — Vessel Codes

**Status:** Gate 3; specification approved.  
**OptionType:** `VESSEL_CODE`. **Table owned:** no separate table; consumes tenant `OptionValue` rows.

## Purpose and boundary

Vessel Codes is a dedicated feature module. Its future `VesselCodeModule` owns its controller, DTOs, validation, lifecycle, Swagger and tests; it fixes `OptionTypeCode.VESSEL_CODE` internally and shares persistence infrastructure only.

Business identity is required `name` plus required `code`, with ID, sort order, lifecycle and timestamps returned. Confirmed future catalogue is CA1/Mega Caravan, CA2/Mega Caravan 2, XCY/Xin Chen Hai Yang, EXT/Other vessel, ALL/Combination. `EXT` is required in the documented catalogue. This task must not seed, insert, migrate, hard-code, or provision these values.

## Rules and safety

- Name and code are required and trimmed; code is uppercased. Do not invent regex/length beyond current structural limits. Further canonicalization is **OWNER DECISION REQUIRED**.
- TenantContext supplies ownership. Queries/writes constrain tenant + VESSEL_CODE (+ ID); POL/POD/Cargo or foreign IDs are hidden 404s.
- Create is active; normal selection excludes inactive, management may include it; stable list order is `sortOrder,name,id`. Lifecycle is deactivate/reactivate only; no hard delete.
- Target uniqueness is normalized name and normalized code within tenant/VESSEL_CODE. A value under another OptionType is outside this module's code-uniqueness boundary.
- Management requires `UPDATE_SETTINGS` and tenant-wide settings scope. `tenant_super_admin` never bypasses either configured check.
- `BidDetail.vesselCodeOptionId` has no Vessel-code snapshot. Referenced identity edits, sortOrder mutation, custom Bid Vessel flow and catalogue population are **OWNER DECISION REQUIRED**. `isDefault` is deferred.

## Boundary and Definition of Done

Vessel Codes supplies a value such as `CA2` for later filenames but creates neither filename nor Project Code and changes no Bid, document, OptionType, schema, migration, RLS, permission, defaults, reorder, import, or data. Done requires isolated six-route lifecycle tests including empty list, code rules, name/code uniqueness, type/tenant isolation, permission/no wildcard and no delete after prerequisites are approved.

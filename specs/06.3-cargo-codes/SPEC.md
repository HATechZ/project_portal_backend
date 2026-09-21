# SPEC: 06.3 — Cargo Codes

**Status:** Gate 3; specification approved.  
**OptionType:** `CARGO_CODE`. **Table owned:** no separate table; consumes tenant `OptionValue` rows.

## Purpose and boundary

Cargo Codes is a dedicated feature module. Its future `CargoCodeModule` owns its controller, DTOs, domain validation, lifecycle, Swagger and tests; it fixes `OptionTypeCode.CARGO_CODE` internally and may reuse shared OptionValue persistence, never a generic public category API.

Business identity is required `name` plus required `code`; response also contains ID, sort order, lifecycle and timestamps. Confirmed future catalogue is ONM/Onshore Module, OFM/Offshore Module, BLK/Block, JKT/Jacket, CRA/Crane, RIG/Rig, OWF/Offshore Wind Farm, OTS/Others. It is documentation only: no seed, insert, migration SQL, runtime array, or automatic tenant provisioning is authorized.

## Rules and safety

- Name and code are required, trim; code is uppercase. No unapproved regex or length beyond structural schema maxima is invented. Exact canonicalization beyond this is **OWNER DECISION REQUIRED**.
- Every operation derives tenant from TenantContext and constrains tenant + CARGO_CODE (+ ID). Other category and foreign IDs are 404.
- Create starts active; normal selection is active-only, management may view inactive; order is `sortOrder,name,id`. Lifecycle preserves historical references; no normal delete.
- Target uniqueness is normalized name and normalized code within tenant/CARGO_CODE. Same code under a different OptionType does not conflict merely due to this module's rule.
- Management requires `UPDATE_SETTINGS` plus tenant-wide settings scope. `tenant_super_admin` is not a wildcard.
- `BidDetail.cargoCodeOptionId` has no Cargo-code snapshot. Referenced identity edits, sortOrder mutation, custom Bid Cargo behavior and population method are **OWNER DECISION REQUIRED**. `isDefault` management is deferred.

## Bid/Project separation override

The earlier combined wording is superseded. Cargo Code supports independent Bid document naming only; direct Project has no approved Cargo dependency.

## Boundary and Definition of Done

Cargo Codes supplies valid values for later names such as `SKM-CRA-CA2`; it generates neither Project Code nor filename and implements no Bid, document code, generic OptionType CRUD, schema/migration/RLS/permission work, defaults, reorder, import or data population. Done requires seven dedicated routes and focused tests for code normalization, both uniqueness targets, isolation, lifecycle, empty state and authorization after normalized DB gaps are resolved.

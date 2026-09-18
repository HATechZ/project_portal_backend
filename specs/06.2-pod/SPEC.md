# SPEC: 06.2 Ã¢â‚¬â€ POD

**Status:** Gate 3; specification approved.  
**OptionType:** `POD`. **Table owned:** no separate table; consumes tenant `OptionValue` rows.

## Purpose and boundary

POD Code is the dedicated Port of Discharge module. Its future `PodCodeModule` owns its controller, DTOs, use cases, validation, lifecycle, Swagger and tests; it internally fixes `OptionTypeCode.POD` and may reuse shared OptionValue persistence only.

POD exposes `id`, `name`, `sortOrder`, `isActive`, timestamps, and no public code. Confirmed future order is Mexico/1, Bangladesh/2, Korea/3, Singapore/4, India/5, UAE/6, Saudi Arabia/7. Numbers are sortOrder onlyÃ¢â‚¬â€not code or name textÃ¢â‚¬â€and this task adds no reference rows, seed, SQL, migration insert, runtime array, or tenant default.

## Rules and safety

- Every operation uses TenantContext and constrains tenant + POD type (+ ID). POL/Cargo/Vessel or foreign IDs are undisclosed 404s.
- Create is active; selector lists are active-only; management may include inactive; deterministic order is `sortOrder,name,id`. Deactivate/reactivate preserves rows and references. No normal delete.
- Name is required, trimmed/nonblank and target-normalized unique within tenant/POD. `OptionValue.code` remains null/not used publicly.
- Management requires `UPDATE_SETTINGS` and tenant-wide settings scope. `tenant_super_admin` has no permission/scope wildcard.
- `BidDetail.podOptionId` has no POD-name snapshot. Referenced identity editing, sortOrder mutation, canonicalization beyond current conventions, and catalogue population are **OWNER DECISION REQUIRED**; `isDefault` management is deferred.

## Boundary and Definition of Done

POD supplies a selection to future Bid/Project/Naming only; it does not generate `SKM` or filenames, manage custom Bid input, OptionTypes, RLS, schema, permissions, defaults, reorder, import, or data population. Done requires dedicated six-route API/lifecycle tests, type/tenant isolation, empty state, ordering, active filtering, authorization and no-delete proof after documented DB/RLS prerequisites are resolved.

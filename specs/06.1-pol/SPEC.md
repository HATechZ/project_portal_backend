# SPEC: 06.1 Ã¢â‚¬â€ POL

**Status:** Gate 3; specification approved.  
**OptionType:** `POL`. **Table owned:** no separate table; consumes tenant `OptionValue` rows.

## Purpose and boundary

POL Code is the dedicated Port of Loading feature module. Its future `PolCodeModule`, controller, DTOs, service/use cases, Swagger, lifecycle and tests are separate from POD, Cargo Code, and Vessel Code. It fixes `OptionTypeCode.POL` internally and may share only persistence infrastructure.

POL business fields are `id`, `name`, `sortOrder`, `isActive`, and timestamps. `OptionValue.code` is null/not public for POL. Confirmed future operational order is Korea/1, Singapore/2, China/3, Japan/4, Malaysia/5, Vietnam/6, Bangladesh/7. These are documented data only: no seed, insert, runtime array, provisioning default, or display such as `01Korea` is approved.

## Rules

- Tenant ownership comes solely from authenticated TenantContext. Every read/write constrains tenant + POL type (+ ID); a POD/Cargo/Vessel or foreign ID is indistinguishable from absent.
- Create starts active. Normal selection lists active values; authorized management may include inactive values. Order is `sortOrder, name, id`. No normal hard delete.
- Name is required, trimmed, nonblank and target-normalized unique per tenant/POL. No POL code.
- Management requires current `UPDATE_SETTINGS` plus tenant-wide settings scope. A `tenant_super_admin` label is never a permission wildcard; current legacy role terminology is not a substitute for configured checks.
- Deactivation/reactivation preserves Bid/document/history references. No POL name snapshot is present on `BidDetail`; identity editing once referenced is **OWNER DECISION REQUIRED**.

## Integration and non-goals

POL supplies a selected value only. Bid/Project/Naming generates Project Code from first characters of Project Name, POL name, and POD name (Samsung Project/Korea/Mexico Ã¢â€ â€™ `SKM`). This module does not implement Bid, Project Code, documents, filenames, defaults, reorder, bulk import, generic OptionType CRUD, data population, permissions, RLS, or schema changes.

**Deferred/owner decisions:** referenced identity edits; public sortOrder mutation; `isDefault`; canonicalization beyond trim/current conventions; population method.

## Definition of Done

Dedicated POL API/lifecycle tests prove empty state, tenant/type isolation, active filtering, permissions, ordering and no delete; DB/RLS prerequisites are approved and independently verified without introducing data.

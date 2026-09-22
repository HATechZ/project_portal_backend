# SPEC: 08 — Bid

**Status:** Gate 3; specification approved. **Runtime target:** `src/bid/**`. **API:** `/api/v1/bids`.

## Boundary

Bid is an independent tenant business module. It is not a Project subtype, workspace, conversion source, or shared Bid/Project service. It owns its future controller → service → repository → UnitOfWork surface, DTOs, status/event lifecycle, files, object authorization, and outbox events. It may share only platform infrastructure: guards, TenantContext/RLS, UnitOfWork, storage port, response/errors, and utilities. `/bid-projects`, `/workspaces`, a type discriminator, source channels, and a combined create surface are forbidden.

The current combined workspace `Project`, `BidDetail`, shared status events, and Project-only document/work-request relations are obsolete for new Bid writes. **DATABASE REDESIGN REQUIRED.** This specification changes no runtime, Prisma, migration, seed, or database data. Vault is unavailable, so no vault sync or hand-written vault log occurs.

## Rules

- Create accepts required structured Bid data and zero-or-more optional binary files. No-file creation succeeds.
- The server derives uppercase `projectCode` from the first character of the trimmed Bid name, POL display name, and POD display name: Salina/Korea/Mexico → `SKM`. It is a business naming component, not database identity.
- Reuse the active, same-tenant Client and fixed-type POL/POD/Cargo/Vessel validation contracts. Relationship truth is stable IDs, never display strings, `clientEmail`, or frontend `projectCode`.
- A new Bid appends independent `BIDDING` status event; current status is derived from the latest event, never stored as mutable `currentStatus`.
- Bid and Project names use one tenant-wide namespace: trim and case-fold the name before comparison. The namespace rejects duplicates within either module and across both modules, but permits reuse in a different tenant.
- Persist creation-time naming snapshots because Client/master data can change. Bid document names use `<BiddingNumber> <ProjectCode>-<CargoCode>-<VesselCode>-<ShipmentNumber>-<DocumentCode>-<RevisionCode> <OriginalBaseFileName>.<extension>`; initial revision foundation is `A`.
- Files use generated tenant/Bid-scoped keys under protected `./uploads`; PostgreSQL stores metadata and key only. Preserve `originalFileName`, `generatedFileName`, `storageKey`, MIME, size, uploader, timestamps, classification, and revision/version metadata. No binary DB storage, public upload folder, external URL as truth, or direct browser S3/R2 upload.
- One General Document Code may classify multiple files. Every file keeps its original name; do not add `(2)`/`(3)`. An exact duplicate complete generated filename within a Bid is a 409 conflict, even though its UUID storage key would differ.
- Reclassifying one persisted file changes its Document Code relation and recalculates only its `generatedFileName`. It does not re-upload, change `originalFileName` or `storageKey`, create a revision, or rename other files. It is audit/history relevant. Editing the General Document Code master never automatically renames historical file names.

## Authorization and Work Request boundary

Authorization uses the existing Module 03 permission/action-grant and object-scope architecture, not controller role comparisons. `ADD_BID` protects create, `VIEW_BID` protects list/detail, and `UPDATE_BID` protects PATCH. Grant policy is locked: the current system-administrator tenant role (owner label `tenant_super_admin`) and current `ccr_coordinator` (CCR) may create and update; those two plus `division_head` and `division_lead` may list/read/detail. Division Head and Division Lead are read-only. No `prime_consultant`, invented admin role, or wildcard bypass is allowed.

Future Work Request may relate one-to-many through a tenant-qualified `bid_id`, or through a DB-enforced exclusive Bid/Project parent. It must not use Project as a Bid surrogate. No Work Request workflow is defined here.

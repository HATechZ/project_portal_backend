# SPEC: 08 — Bid

**Status:** Gate 3; specification approved. **Runtime target:** `src/bid/**`. **API:** `/api/v1/bids`.

> **SUPERSEDED ROLE CONTENT:** [`ROLE_ARCHITECTURE_FREEZE.md`](../ROLE_ARCHITECTURE_FREEZE.md) is authoritative. Fixed-role rules, grant matrices, role-name authorization, and legacy custom-scope statements here are retained only as historical implementation context.

## Boundary
Bid is an independent tenant business module. It is not a Project subtype, workspace, conversion source, or shared Bid/Project service. It owns its future controller → service → repository → UnitOfWork surface, DTOs, status/event lifecycle, files, object authorization, and outbox events. It may share only platform infrastructure: guards, TenantContext/RLS, UnitOfWork, storage port, response/errors, and utilities. `/bid-projects`, `/workspaces`, a type discriminator, source channels, and a combined create surface are forbidden.

The current combined workspace `Project`, `BidDetail`, shared status events, and Project-only document/work-request relations are obsolete for new Bid writes. **DATABASE REDESIGN REQUIRED.** This specification changes no runtime, Prisma, migration, seed, or database data. Vault is unavailable, so no vault sync or hand-written vault log occurs.

## Rules

- Create accepts required structured Bid data and zero-or-more optional binary files. No-file creation succeeds.
- The server derives uppercase `projectCode` from the first character of the trimmed Bid name, POL display name, and POD display name: Salina/Korea/Mexico → `SKM`. It is a business naming component, not database identity.
- Reuse the active, same-tenant Client and fixed-type POL/POD/Cargo/Vessel validation contracts. Relationship truth is stable IDs, never display strings, `clientEmail`, or frontend `projectCode`.
- A new Bid appends independent `BIDDING` status event; current status is derived from the latest event, never stored as mutable `currentStatus`.
- Bid and Project names use one tenant-wide namespace: trim and case-fold the name before comparison. The namespace rejects duplicates within either module and across both modules, but permits reuse in a different tenant.
- Persist creation-time naming snapshots because Client/master data can change. Bid document names use `<BiddingNumber> <ProjectCode>-<CargoCode>-<VesselCode>-<ShipmentNumber>-<DocumentCode>-<RevisionCode> <DocumentName>.<extension>`; Document Name is the selected Document Code name, never the uploaded base filename; initial revision foundation is `A`.
- Files use generated tenant/Bid-scoped keys under protected `./uploads`; PostgreSQL stores metadata and key only. Preserve `originalFileName`, `generatedFileName`, `storageKey`, MIME, size, uploader, timestamps, classification, and revision/version metadata. No binary DB storage, public upload folder, external URL as truth, or direct browser S3/R2 upload.
- One General Document Code may classify multiple files. Every file keeps its original name; do not add `(2)`/`(3)`. Generated filename is not document or storage identity; version ID/storage key distinguish versions even when generated names and revision codes match.
- Reclassifying one persisted file changes classification metadata and records history. It does not re-upload, change `originalFileName` or `storageKey`, create a revision, or rename any historical version. Editing the General Document Code master never automatically renames historical file names.

## Authorization and Work Request boundary

## 2026-10-07 visibility addendum

`VIEW_BID` is Company-wide only for Company scope. Division, Team, and Member scope require
visibility to at least one related Work Request under the authoritative Work Request predicate;
a Bid without a related visible Work Request is not visible to lower scopes. This uses no role
label and governs list and detail equally.

## Authorization and Work Request boundary

Authorization uses the existing Module 03 permission/action-grant and object-scope architecture, not controller role comparisons. `ADD_BID` protects create, `VIEW_BID` protects list/detail, and `UPDATE_BID` protects PATCH. Grant policy is locked: the current tenant-super-administrator tenant role (owner label `tenant_super_admin`) and current `ccr_coordinator` (CCR) may create and update; those two plus `division_head` and `division_lead` may list/read/detail. Division Head and Division Lead are read-only. No `prime_consultant`, invented admin role, or wildcard bypass is allowed.

Future Work Request may relate one-to-many through a tenant-qualified `bid_id`, or through a DB-enforced exclusive Bid/Project parent. It must not use Project as a Bid surrogate. No Work Request workflow is defined here.

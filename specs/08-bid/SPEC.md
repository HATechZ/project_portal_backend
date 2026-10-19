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

## C3 freeze — business outcome, conversion, and business cycles

This section supersedes the historical Boundary wording that called Bid “not a conversion source”, and every historical combined-workspace description of Bid → Project conversion. Bid is a permanent independent aggregate, not a Project subtype, Workspace, shared identity, or mutable Project precursor. C3 has no canonical Workspace aggregate.

- A DirectProject is either direct-created or newly created from a successful Bid business outcome. It is a separate permanent aggregate: `Bid.id` and `DirectProject.id` are always different. Conversion never mutates a Bid into a Project.
- The original Bid remains queryable forever with its original fields, Bid documents and versions, Bid-owned Work Requests, Client submissions/decisions, nested information requests, events/audit, outcome, and conversion history.
- A new C3 Bid starts immutable business cycle 1. At the C3 migration baseline, every existing active/non-archived Bid receives immutable cycle 1 and every currently Bid-owned Work Request for that Bid is explicitly enrolled in it, without changing its parent, state, history, C1, or C2 data. This is the sole approved membership backfill, not timestamp inference or historical-cycle reconstruction. A rejection closes the current cycle and archives the Bid. An authorized archived-review request followed by authorized restore/reopen keeps the same Bid and creates the next immutable cycle; it never deletes or overwrites the rejection or an older cycle. A legacy Bid already archived at baseline receives no active-cycle enrollment; when later validly restored under C3, it starts its first C3 active cycle with no automatically enrolled pre-C3 Work Requests.
- Readiness is calculated from persisted current-cycle data only: at least one Bid-owned Work Request must belong to the current cycle, and every such request must have its latest authoritative client outcome of `ACCEPTED`. Zero requests, no client decision, an incomplete request, `CLIENT_REVIEW`, `CLIENT_REVISION_REQUESTED`, or `REJECTED` makes the Bid not ready. Frontend counters are never authoritative.
- Successful outcome atomically revalidates readiness, creates a new DirectProject and its normal initial status event/name claim, records an immutable success outcome, and records one immutable conversion. It calls the existing canonical DirectProject-code generator, then derives the display name as `<Bid Name> - <Generated Project Code>` before normalizing/reserving it through the existing name-claim mechanism. If a length limit applies, only the Bid-name portion is truncated; the separator and complete generated code remain. The Bid keeps its exact claim: C3 never renames it, transfers/releases its claim, weakens uniqueness, hardcodes a code format, or adds a random suffix unless the canonical naming service does so.
- Rejection atomically revalidates readiness, records an immutable rejected outcome, archives the Bid, and closes the cycle. It does not rewrite, archive, reparent, or otherwise change child Work Request states; accepted children remain accepted history.
- Historical Bid Work Requests remain `bidId = Bid.id` and `projectId = null`. They are never copied or reparented to the converted DirectProject. Future Project Work Requests use only the new DirectProject parent. New Bid Work Requests record immutable current-cycle membership; pre-C3 rows with no membership remain readable but cannot be silently interpreted as a cycle or satisfy C3 readiness.
- Bid documents and all their DocumentVersions remain Bid-owned. C3 does not carry documents forward. A later separately-approved feature may create explicit references to exact immutable Bid DocumentVersion IDs; it must never duplicate bytes or change document ownership.
- C3 uses only exact compatible permissions plus tenant, Company/resource, state, and relationship checks: `DECIDE_BID_OUTCOME` for a successful decision; `DECIDE_BID_OUTCOME` and `ARCHIVE_BID` for rejection/archive; `REQUEST_ARCHIVED_BID_REVIEW`; and `RESTORE_BID`. There is no role-name, designation, or tenant-super-admin bypass.
- The exception allowing a no-member `tenant_super_admin` to perform initial Work Request routing does not apply to Bid decisions, archive, review, restore, submission, or reviewer responsibilities.
- Outcome, conversion, archive, review-request, and reopen writes are serializable/idempotent transactions. They revalidate the Bid, current cycle, and all-Work-Request readiness inside the transaction and write required audit/outbox events in that same transaction. C3 remains transport-agnostic; RabbitMQ is not part of C3.
- The successful-outcome transaction is: lock/reload Bid and current cycle; revalidate current-cycle readiness; verify no terminal outcome/conversion; generate/reserve the canonical DirectProject code; derive/reserve the converted name; create the new DirectProject; write the successful outcome; write the immutable conversion; close the cycle; append required audit/status records; write transactional outbox records; commit atomically. Repository ordering may place the outcome insert before Project creation only where an FK requires it, while retaining this single transaction and every invariant.

Later C3 implementation must retain the existing Auth/tenant/grant, Bid and DirectProject CRUD/read, Work Request routing/available-actions, C1 client lifecycle, C2 nested-information, document/version, visibility, and outbox/audit regression suites. Any old test that asserts a same-workspace identity, a Bid-to-Project ID mutation, or child Work Request/document reparenting is obsolete and must be replaced only with these frozen independent-aggregate assertions.

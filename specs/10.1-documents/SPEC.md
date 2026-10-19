# SPEC: 10.1 — Shared Document Upload & Versioning

**Status:** Gate 3 draft; implementation not started. **Runtime target:** shared document pipeline consumed by Bid, Direct Project, and Work Request. **API ownership:** parent controllers; there is no generic document controller.

**Weekly-scope authority:** [Formal Revision Lifecycle](FORMAL_REVISION_LIFECYCLE.md) freezes the additive generic revision contract; [Document Upload & Storage Lifecycle](UPLOAD_STORAGE_LIFECYCLE.md) freezes provider-neutral upload/storage evolution. Those contracts preserve this module's current document/version rules and C1 exact-package snapshots.

## Boundary

This module defines one reusable, storage-agnostic document pipeline for validation, document-code validation, naming, original-name tracking, protected storage, metadata, immutable versions, cleanup, and audit. Bid, Direct Project, and Work Request remain independent aggregates, routes, authorization boundaries, and persistence owners. This module neither merges them nor revives legacy `Document`/folder structures.

Existing create-time uploads (`POST /bids`, `POST /projects`, and `POST /work-requests`) are consumers of the same pipeline after Phase 4. A filename is never an identity or lineage rule.

## Invariants

| # | Rule |
|---|---|
| D-01 | A logical document has a stable `documentId`, exactly one tenant-qualified parent/source context, a document code, immutable first-upload `originalFileName`, and history. |
| D-02 | A version has a new immutable `versionId`; it records its actual sanitized incoming `uploadedFileName`, official `generatedFileName`, protected `storageKey`, MIME/size, uploader, and time. Checksum is returned/stored only if the then-current storage ingestion architecture produces one. |
| D-03 | `POST .../documents` always creates a new logical document and first version. `POST .../documents/:documentId/versions` always appends a version to that exact parent-owned document. Same incoming or generated filename creates neither linkage nor conflict by itself. |
| D-04 | `Document.originalFileName` is the first user-uploaded source filename and never changes. A version upload may itself be named with the generated working filename; it remains a version because the route's `documentId`, not that filename, selects lineage. |
| D-05 | Version number is chronological per document and history is append-only. File version and workflow `revisionCode` are separate: upload does not advance `revisionCode` unless the current parent workflow rules explicitly do so. |
| D-06 | Bid official name is `<BiddingNumber> <ProjectCode>-<CargoCode>-<VesselCode>-<ShipmentNumber>-<DocumentCode>-<RevisionCode> <DocumentName>.<ext>`. Direct Project omits only `<BiddingNumber>`. `ProjectCode` is backend-derived from the uppercase first characters of Project Name, POL, and POD. Cargo/Vessel use approved master code values; Shipment Number uses approved two-digit normalization; Document Code and Document Name use immutable selected-code snapshots. |
| D-07 | `<DocumentName>` is the selected Document Code definition's name, never the user-uploaded base filename. `originalFileName` remains first-source metadata and each version's `uploadedFileName` remains incoming-source metadata. |
| D-08 | Once created, a version's `generatedFileName` is immutable. Parent/reference/code changes never rename historical versions; a new version resolves only its then-valid snapshot context. |
| D-09 | Every command requires authenticated tenant context, permission, object/resource scope, and tenant-qualified parent/document ownership. `tenant_super_admin` is not a wildcard bypass. |
| D-10 | Working-version upload additionally requires the active responsible producer/assignment and an allowed workflow state. For Work Request, the assigned Member may upload in `MEMBER_ASSIGNED`; upload is locked in `MEMBER_SUBMITTED`; a return to `MEMBER_ASSIGNED` re-enables that responsible Member. Reviewers do not become producers merely by reviewing. |
| D-11 | Store protected bytes before persistence; on failed persistence compensate stored keys, durably queue failed cleanup, and never report success. Persisted storage keys are server-generated and are never returned as public paths. |

## Acceptance criteria

## 2026-10-07 parent visibility addendum

Read visibility inherits from the business parent: Bid documents require visible Bid, Project
documents require visible Project, and Work Request documents require visible Work Request. The
same rule applies to list and immutable version/history reads. `VIEW_DOCUMENT` alone never exposes
an unrelated Tenant document; external Client/ClientContact rules remain independent.

## Acceptance criteria

- WHEN a parent new-document route receives `files[]`, it SHALL require equally sized positional `documentCodeIds[]` and validate one active, tenant-valid code per file.
- WHEN a version route receives one file, it SHALL inherit the existing document's code and SHALL reject caller-supplied lineage/classification fields.
- WHEN a document/version belongs to another tenant or parent, the system SHALL not expose or mutate it through the requested parent route.
- WHILE Work Request is `MEMBER_SUBMITTED`, the Member version command SHALL fail; WHEN revision returns it to `MEMBER_ASSIGNED`, only the currently assigned responsible Member may upload again.
- The system SHALL return document/source, code, immutable original name, latest version metadata, generated name, version/revision metadata, uploader, and upload time without exposing a storage key.

## Out of scope

Frontend folder trees, preview/download UI, move/delete-folder UI, company-specific workflow implementations, file deletion, generic cross-parent API, and unrelated Bid/Project/Work Request changes are out of scope. Folder structure remains presentation; document classification/version/storage metadata is backend truth.

Legacy Direct Project versions with `generatedFileName = null` are preserved and are never assigned a fabricated historical name without provable naming data.

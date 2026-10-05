# Data Contract: 10.1 — Shared Document Upload & Versioning

## Current evidence and target boundary

Current Prisma has independent tenant-qualified pairs: `BidDocument`/`BidDocumentVersion`, `DirectProjectDocument`/`DirectProjectDocumentVersion`, and `WorkRequestV1Document`/`WorkRequestV1DocumentVersion`. Their stable IDs, composite tenant parent/actor relations, per-document version-number uniqueness, and RLS pattern are the target precedent. The legacy generic `Document`/`DocumentVersion` is Project/folder-era and is not a migration target for this domain.

The shared pipeline is a service/port boundary, not a mandate for one type-discriminated business table. Each parent keeps an independent document and version relation with its tenant-qualified parent FK. Schema work is proposed only for a later approved implementation phase; this specification changes no schema, migration, or data.

## Required logical shape

Each parent document relation persists: `id` (`documentId`), tenant ID, its sole parent FK, document code ID and immutable code/name snapshots, immutable `originalFileName` from first upload, creation uploader/time, and classification/audit history. It represents logical identity, not a current file blob.

Each version relation persists: `id` (`versionId`), tenant ID, logical document FK, immutable sequential `versionNumber`, **`uploadedFileName`** (actual safe incoming name for that version), generated official filename (nullable only where current approved naming is incomplete), immutable storage key, MIME type, byte size, checksum only when supported, workflow `revisionCode`, uploader, and upload time. Unique `(tenant_id, document_id, version_number)` and oldest/newest deterministic ordering are required. Historical version rows are insert-only.

The current version `originalFileName` field cannot represent both meanings: a future migration must map/rename it to per-version `uploadedFileName`, retain parent `originalFileName` as first-source identity, and backfill without guessing history. Current parent binary columns (`storageKey`, MIME, size, generated filename) are a latest projection duplicated from versions; target reads use the latest version (or an explicitly maintained latest-version projection), never mutable historical data. Generated filenames are immutable version facts, not a unique identity: multiple versions may share one generated name and revision code, while version ID/storage key remain unique.

No current checksum field or storage checksum producer exists; checksum is omitted/null rather than fabricated until architecture supports it.

## Naming and storage

Keys remain server-generated in the existing protected parent namespaces, e.g. `tenants/<tenant>/bids/<bid>/documents/<uuid>.<ext>`, with analogous `projects` and `work-requests` namespaces. They are not input, identity, or public URLs. Local storage's root-containment protection and atomic temporary-write/rename behavior remain required.

Bid names resolve as `<BiddingNumber> <ProjectCode>-<CargoCode>-<VesselCode>-<ShipmentNumber>-<DocumentCode>-<RevisionCode> <DocumentName>.<ext>`. Direct Project names resolve as `<ProjectCode>-<CargoCode>-<VesselCode>-<ShipmentNumber>-<DocumentCode>-<RevisionCode> <DocumentName>.<ext>`. `<DocumentName>` is the selected General Document Code name snapshot; only `<ext>` comes from the actual uploaded filename. The existing Bid helper must be aligned in implementation to receive the document-name snapshot rather than the uploaded base filename.

Direct Project creation/persistence must add tenant-qualified `polId`, `podId`, `cargoId`, `vesselId`, normalized `shipmentNumber`, and backend-derived `projectCode`. It must snapshot POL/POD naming values, Cargo/Vessel code values, Project Code, Shipment Number, and selected Document Code code/name when a document/version is created. It validates active same-tenant master records and never trusts a client `projectCode`. These additions are proposed schema/API work only; no schema change occurs here.

Once a version name is persisted, it is never recalculated because parent, master, or Document Code records later change. New versions use valid current references plus the snapshots created at their upload. Existing Direct Project records with a null generated filename remain null unless a future migration has provable historical naming inputs.

## Tenancy, audit, consistency

Every document/version/audit/cleanup relation retains tenant ownership, tenant-qualified FKs, TenantContext repository predicates, RLS `USING`/`WITH CHECK`, least grants, and no `BYPASSRLS`. Parent lookup and document lookup occur together in the same parent repository scope. Upload audit captures action, parent/source, document/version IDs, actor, time, correlation/request ID, and idempotency key where platform supports it.

The shared pipeline writes storage then persists document/version/audit/outbox facts in one UnitOfWork. Database failure triggers storage compensation; a failed remove is durably enqueued using a shared cleanup abstraction or adapters over the current Bid/Project/Work Request cleanup queues. No success is emitted until persistence succeeds. Idempotent retries must not create another document, version, audit fact, or cleanup intent.

## Migration impact — proposed, not authorized

Later schema work aligns all three parent pairs to this shape, backfills only provable first/current version facts, preserves legacy rows when provenance is ambiguous, adds tenant/RLS/grant proof, and removes no legacy structure until consumers switch. Application/repository behavior must prevent version update/delete; migration-level privilege/trigger hardening is a later implementation design task. No migration is requested by this spec.

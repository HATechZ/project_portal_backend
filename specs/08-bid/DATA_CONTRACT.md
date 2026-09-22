# Data Contract: 08 — Bid

## DATABASE REDESIGN REQUIRED

Current `projects.workspace_type_id`, `bid_details.project_id`, shared Project events, and Project-only document/work-request FKs make Bid a Project subtype. New writes must not retain that model.

`bids` is independent: UUID id/tenant_id/client_id, name, derived project_code, bidding_number, normalized shipment_number, required POL/POD/Cargo/Vessel option IDs, creator, and timestamps. It has no project ID, type, workspace, source channel, origin division, or Bid-level document code. It uses tenant-qualified Client/master/actor FKs and snapshots the POL/POD display inputs, Cargo/Vessel codes, bidding number, project code, and shipment number. `(id, tenant_id)` is unique; `projectCode` is not an identity/uniqueness key.

`bid_statuses` and append-only `bid_status_events` hold tenant, bid, nullable from, required to, changer, reason, occurredAt; index `(bid_id, occurred_at DESC, id DESC)`. At least `BIDDING` exists. Latest event with deterministic ID tie-breaker derives state; no `current_status`.

`bid_documents` and `bid_document_versions` are Bid-specific, not type-discriminated shared business tables. They hold a tenant-qualified Bid FK, General Document Code FK/snapshot, `originalFileName`, `generatedFileName`, `storageKey`, MIME, size, uploader, timestamps, and revision/version metadata. `storageKey` is safely generated as `tenants/<tenantId>/bids/<bidId>/documents/<uuid>.<extension>`; it is immutable through reclassification. Enforce unique `(bid_id, generated_file_name)` to make exact completed-name collisions a 409 while allowing many files with one document code.

### Cross-module name claim

Use a neutral `business_name_claims` registry, not a shared BidProject domain: `tenant_id`, `normalized_name`, nullable `bid_id`, nullable `project_id`, audit timestamps, tenant-qualified FKs, and a check that exactly one owner FK is populated. A unique `(tenant_id, normalized_name)` is the authoritative concurrency barrier. It has no combined endpoint, lifecycle, status, DTO, service, or type field.

Create generates the independent Bid UUID, inserts the Bid and its claim in one UnitOfWork transaction, and maps the registry unique violation to 409. Rename locks/updates the Bid and its claim in the same transaction; a target occupied by either a Bid or Project is 409. Delete/rollback of a failed create removes the matching claim transactionally. Tenant RLS and repository TenantContext predicates apply to the registry and every Bid table; no BYPASSRLS.

Migration later expands independent tables/RLS/FKs/registry, backfills legacy BID workspace rows/events/files, quarantines unclassifiable records rather than guessing, validates counts/FKs/RLS/latest events/storage keys/name claims, switches reads/writes, then contracts obsolete workspace/type/BidDetail/conversion/outcome/source-channel structures after consumers leave. Work Requests migrate only after their contract.

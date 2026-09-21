# Data Contract: 14 — Bid

## DATABASE REDESIGN REQUIRED

Current `projects.workspace_type_id`, `bid_details.project_id`, shared Project events, and Project-only Document/WorkRequest FKs make Bid a Project subtype. New writes must not retain that model.

`bids`: UUID id/tenant_id/client_id, name, derived project_code, bidding_number, normalized shipment_number, required POL/POD/Cargo/Vessel option IDs, required document_code_option_id, creator and timestamps. Use tenant-qualified Client/master/actor FKs (add composite parent keys where necessary). No project ID/type/workspace/source channel/origin division. Snapshot POL/POD display inputs, Cargo/Vessel code/name, General Document Code, bidding number, project code and shipment number at creation. Current relations alone cannot preserve historical names. `(id, tenant_id)` is unique; `(tenant_id, project_code)` requires **OWNER DECISION REQUIRED** on collision policy.

`bid_statuses` and append-only `bid_status_events`: tenant, bid, nullable from, required to, changer, reason, occurredAt; index `(bid_id, occurred_at DESC, id DESC)`. At least BIDDING; derive latest status with deterministic ID tie-breaker; no `current_status`.

Use independent `bid_documents`/`bid_document_versions` (not a type-discriminated shared business table) with tenant-qualified Bid FK. Store original/generated filename, storage key, MIME, size, uploader, timestamps, General Code/naming snapshots and existing revision/version fields; binaries are storage only. Future WR uses `bid_id`, or `(bid_id XOR project_id)` plus tenant composite FKs.

All tenant tables enable `app_user` RLS with current tenant `USING`/`WITH CHECK`, least privilege and repository TenantContext predicates—never BYPASSRLS.

Migration: expand independent tables/RLS/FKs; backfill old BID workspace rows and events/files; quarantine unclassifiable records rather than guess; validate counts/FKs/RLS/latest event/storage keys; switch reads/writes; migrate WR only after its contract; contract old workspace/type/BidDetail/conversion/outcome/source-channel structures only after consumers leave. Keep mapping/old data until contraction; historical WRs remain Project-linked unless explicitly mapped.

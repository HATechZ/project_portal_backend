# Data Contract: 15 — Project

## DATABASE REDESIGN REQUIRED

The current Project requires workspace type, code/origin division and carries BidDetail/source channel/shared events/conversions/outcomes plus Project-only Document/WorkRequest FKs. It cannot serve a genuinely independent direct Project.

New `projects`: UUID id, tenant_id, client_id, name, creator and timestamps; company policy follows Client scope. Use `(id, tenant_id)` and tenant-qualified Client/Actor FKs. No workspace type, Bid relation/detail, source channel, origin division, or code unless an explicit independent Project policy approves it. Existing required `code` must be made nullable/removed or server-derived by a new policy: **OWNER DECISION REQUIRED**; never reuse Bid code rule.

`project_statuses` and append-only `project_status_events`: tenant, project, nullable from, required to, changer, reason, occurredAt; index `(project_id, occurred_at DESC, id DESC)`. At least ACTIVE; derive latest status with deterministic tie-breaker; no mutable status column.

Use Project-specific `project_documents`/`project_document_versions`, not a type-discriminated shared business table. Tenant-qualified Project parent relation stores safe filename/version metadata, storage key, MIME, byte size, uploader/timestamps and existing revision fields. Project does not require General Document Code or a new naming template. Future `work_requests.project_id` is tenant-qualified and distinct from Bid FK.

Every tenant table has current `app_user` RLS `USING`/`WITH CHECK`, least grants and repository TenantContext predicates; no BYPASSRLS or relay bypass.

Migration expands new independent tables/RLS/FKs; backfills legacy PROJECT workspace rows/events/files/WRs separately from BID rows; validates counts/FKs/latest events/storage keys/RLS; switches read/write; then contracts workspace/type/BidDetail/conversion/outcome/source-channel after consumers leave. Unclassifiable records and conversion history need owner policy; do not discard/guess.

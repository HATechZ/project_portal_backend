# Document Upload & Storage Lifecycle

**Status:** authoritative weekly-scope contract. **Compatibility:** current local multipart upload and `LocalFileStorageService → ./uploads` remain supported.

## Preserved core and provider boundary

Document and parent-specific immutable DocumentVersion relations remain canonical. Existing `storageKey`, original/uploaded/generated names, MIME, size, uploader/time, `versionNumber`, and `revisionCode` retain their meanings. Existing local files and C1 exact version references remain valid.

`FileStorage` becomes the provider-neutral port: `LOCAL` writes through the current service under `./uploads`; future `S3_COMPATIBLE` writes S3/MinIO/R2-compatible objects. `STORAGE_DRIVER=local|s3` selects implementation. Business validation, tenancy, naming, version allocation, audit, cleanup, and response shape are provider-independent; Local is never removed.

Keys are server-generated opaque tenant namespaces (for example `tenants/<tenant>/<owner>/<parent>/documents/<document-or-upload>/<nonce>`). Caller filenames are metadata only. Clients never supply key/path/version/revision/generated name. Root containment/path traversal protection, immutable final key, collision-resistant nonce, and no silent replacement are mandatory.

## New upload-session lifecycle

`UPLOAD_INIT → PENDING_UPLOAD → physical upload → UPLOAD_COMPLETE → verification → DocumentVersion finalized`; failures end `FAILED`, `EXPIRED`, or `ABANDONED`. A completed DocumentVersion is never created before verification. A new additive tenant-owned upload-session/receipt is required unless the current `DocumentUploadRequest` can be extended without changing its completed-receipt meaning: owner/parent/document intent, actor, request ID, opaque key, provider, declared name/MIME/size, expiry, status, checksum metadata when available, and final version ID.

`POST <parent>/:id/uploads/init` accepts only parent/document-code intent, original filename, declared MIME, and declared size. It validates authentication, tenant, parent visibility, upload permission, exact producer responsibility/state where required, code/ownership, MIME/size policy, and returns safe upload ID, expiry, and provider instructions. LOCAL returns a backend-managed upload target/session; S3 returns short-lived presigned instructions. No storage path is returned as a durable public URL.

LOCAL physical upload is frontend → controlled backend handler → LocalFileStorageService → `./uploads`. S3 physical upload is frontend → presigned single-object upload (multipart support is provider-internal and required only above configured threshold). Max size and allowed MIME are centrally configured and identical semantically across providers.

`POST <parent>/:id/uploads/:uploadId/complete` accepts upload ID plus safe provider proof only. It verifies session/actor/tenant/parent, expiry/status/idempotency, expected key, physical existence, actual size, allowed actual type, and provider/session ownership. Only then it allocates version number/revision code server-side, finalizes the immutable version, persists metadata/audit/outbox, and marks complete.

## Integrity, retries, cleanup, and reads

Mandatory now: object existence, exact key/session match, actual-versus-declared size, allowed MIME/type, non-zero bytes, and replacement protection. SHA-256 is future-ready but **not mandatory until a supported provider/backend calculation and additive field are approved**; if present, mismatch fails completion. Missing/truncated/zero-byte objects fail. DB-finalization failure compensates the unreferenced object and durably records cleanup; cleanup never deletes a completed referenced key. Expired/abandoned sessions are safely retryable only through a new/replayed init; future cleanup may be asynchronous but needs no RabbitMQ work now.

`x-request-id` follows repository receipts: same init replays its safe session; same complete replays its final version; concurrent completes serialize to one result; concurrent versions serialize per Document and cannot duplicate version numbers. Existing multipart endpoints coexist in Phase 1 and retain their current idempotency/compensation behavior.

Reads remain authorized (`VIEW_DOCUMENT` + parent visibility + tenant + external package restrictions). LOCAL streams through an authorized backend endpoint; S3 uses an authorized short-lived presigned download or proxy. Raw keys/paths never become unrestricted URLs.

## Rollout and proof

Phase 1: local provider + coexistence with current multipart endpoints; no local-object migration. Phase 2: configurable S3 provider. Phase 3: optional verified migration of old local objects, retaining original storage references until successful. No endpoint removal without separate deprecation approval.

Required negatives: foreign tenant/parent/actor, invalid state, unsupported MIME/oversize, caller key/path, expiry/missing object/size mismatch, checksum mismatch when enabled, duplicate/concurrent complete, abandoned object, traversal, cross-tenant read, overwrite, failed finalization cleanup, and readable pre-existing local versions.

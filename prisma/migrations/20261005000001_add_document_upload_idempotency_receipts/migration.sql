-- Persist completed standalone upload operations so the existing x-request-id
-- can replay a prior document/version response without another document,
-- version, audit fact, outbox event, or storage write. `target_id` is never
-- NULL: it is the parent id for NEW_DOCUMENT and the logical document id for
-- NEW_VERSION. This makes the composite unique key effective in PostgreSQL.
--
-- Rollback: revoke access, drop the RLS policy and table, then drop the two
-- enum types. This removes only idempotency receipts; it does not remove any
-- already-persisted document, version, audit, outbox, or storage object.

CREATE TYPE "document_upload_owner_code" AS ENUM ('BID', 'DIRECT_PROJECT', 'WORK_REQUEST');
CREATE TYPE "document_upload_operation_code" AS ENUM ('NEW_DOCUMENT', 'NEW_VERSION');

CREATE TABLE "document_upload_requests" (
  "tenant_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "owner" "document_upload_owner_code" NOT NULL,
  "parent_id" UUID NOT NULL,
  "target_id" UUID NOT NULL,
  "operation" "document_upload_operation_code" NOT NULL,
  "request_id" VARCHAR(128) NOT NULL,
  "response" JSONB NOT NULL,
  "created_by_actor_id" UUID NOT NULL,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_upload_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "document_upload_requests_tenant_owner_parent_target_operation_request_key"
    UNIQUE ("tenant_id", "owner", "parent_id", "target_id", "operation", "request_id"),
  CONSTRAINT "document_upload_requests_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "document_upload_requests_created_by_actor_id_tenant_id_fkey"
    FOREIGN KEY ("created_by_actor_id", "tenant_id") REFERENCES "actor_profiles"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "document_upload_requests_tenant_owner_parent_operation_request_idx"
  ON "document_upload_requests"("tenant_id", "owner", "parent_id", "operation", "request_id");
CREATE INDEX "document_upload_requests_created_at_idx"
  ON "document_upload_requests"("created_at");

ALTER TABLE "document_upload_requests" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_document_upload_requests ON "document_upload_requests"
  AS PERMISSIVE FOR ALL TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

-- Receipts are immutable after insert. Cleanup is not permitted because it
-- would make a later retry non-idempotent.
GRANT SELECT, INSERT ON TABLE "document_upload_requests" TO app_user;

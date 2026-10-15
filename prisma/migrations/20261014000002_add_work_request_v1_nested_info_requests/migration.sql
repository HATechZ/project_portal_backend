-- Add tenant-safe nesting for Work Request V1 clarification requests.
-- Same-work-request parentage is validated by the command path because a
-- PostgreSQL CHECK constraint cannot compare another row.
--
-- Rollback: stop nested clarification writes, retain any required attachment
-- history, drop the two attachment tables and their RLS policies, then drop
-- the request/response idempotency constraints and columns. Set
-- parent_info_request_id to NULL for retained child history if necessary,
-- then drop its FK, index, and column.

ALTER TABLE "work_request_v1_info_requests"
  ADD COLUMN "parent_info_request_id" UUID;

ALTER TABLE "work_request_v1_info_requests"
  ADD CONSTRAINT "wr_v1_info_requests_parent_tenant_fk"
  FOREIGN KEY ("parent_info_request_id", "tenant_id")
  REFERENCES "work_request_v1_info_requests"("id", "tenant_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "wr_v1_info_requests_parent_tenant_idx"
  ON "work_request_v1_info_requests"("parent_info_request_id", "tenant_id");

-- Requests and responses have their own command receipts.  The nullable
-- correlation remains trace metadata; the tenant/idempotency key is the
-- durable uniqueness boundary for retry and concurrent-write handling.
ALTER TABLE "work_request_v1_info_requests"
  ADD COLUMN "correlation_id" UUID,
  ADD COLUMN "idempotency_key" VARCHAR(160),
  ADD CONSTRAINT "work_request_v1_info_requests_tenant_idempotency_key_key"
    UNIQUE ("tenant_id", "idempotency_key");

ALTER TABLE "work_request_v1_info_responses"
  ADD COLUMN "correlation_id" UUID,
  ADD COLUMN "idempotency_key" VARCHAR(160),
  ADD CONSTRAINT "work_request_v1_info_responses_tenant_idempotency_key_key"
    UNIQUE ("tenant_id", "idempotency_key");

-- Attachment rows reference immutable V1 document versions.  The command path
-- verifies that the version belongs to the exact Work Request before insert;
-- tenant-qualified foreign keys prevent cross-tenant references and the unique
-- relation makes attachment retries stable.
CREATE TABLE "work_request_v1_info_request_attachments" (
  "tenant_id" UUID NOT NULL, "id" UUID NOT NULL, "info_request_id" UUID NOT NULL,
  "document_version_id" UUID NOT NULL,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "work_request_v1_info_request_attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "work_request_v1_info_request_attachments_id_tenant_id_key" UNIQUE ("id", "tenant_id"),
  CONSTRAINT "work_request_v1_info_request_attachments_tenant_request_version_key" UNIQUE ("tenant_id", "info_request_id", "document_version_id"),
  CONSTRAINT "work_request_v1_info_request_attachments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "wr_v1_info_request_attachments_request_tenant_fk" FOREIGN KEY ("info_request_id", "tenant_id") REFERENCES "work_request_v1_info_requests"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "wr_v1_info_request_attachments_version_tenant_fk" FOREIGN KEY ("document_version_id", "tenant_id") REFERENCES "work_request_v1_document_versions"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "wr_v1_info_request_attachments_version_tenant_idx"
  ON "work_request_v1_info_request_attachments"("document_version_id", "tenant_id");

CREATE TABLE "work_request_v1_info_response_attachments" (
  "tenant_id" UUID NOT NULL, "id" UUID NOT NULL, "info_response_id" UUID NOT NULL,
  "document_version_id" UUID NOT NULL,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "work_request_v1_info_response_attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "work_request_v1_info_response_attachments_id_tenant_id_key" UNIQUE ("id", "tenant_id"),
  CONSTRAINT "work_request_v1_info_response_attachments_tenant_response_version_key" UNIQUE ("tenant_id", "info_response_id", "document_version_id"),
  CONSTRAINT "work_request_v1_info_response_attachments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "wr_v1_info_response_attachments_response_tenant_fk" FOREIGN KEY ("info_response_id", "tenant_id") REFERENCES "work_request_v1_info_responses"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "wr_v1_info_response_attachments_version_tenant_fk" FOREIGN KEY ("document_version_id", "tenant_id") REFERENCES "work_request_v1_document_versions"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "wr_v1_info_response_attachments_version_tenant_idx"
  ON "work_request_v1_info_response_attachments"("document_version_id", "tenant_id");

ALTER TABLE "work_request_v1_info_request_attachments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "work_request_v1_info_response_attachments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_work_request_v1_info_request_attachments ON "work_request_v1_info_request_attachments" AS PERMISSIVE FOR ALL TO app_user USING ("tenant_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY tenant_isolation_work_request_v1_info_response_attachments ON "work_request_v1_info_response_attachments" AS PERMISSIVE FOR ALL TO app_user USING ("tenant_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);
GRANT SELECT, INSERT, UPDATE ON TABLE "work_request_v1_info_request_attachments", "work_request_v1_info_response_attachments" TO app_user;

-- Match REQUEST_INFO external compatibility to RESPOND_TO_INFO_REQUEST so an
-- authorized external recipient can open a nested clarification request.
INSERT INTO public.permission_scope_compatibilities (permission_id, scope)
SELECT permission.id, requested_scope.scope
FROM public.permissions AS permission
CROSS JOIN (VALUES
  ('client'::public.custom_role_scope),
  ('client_contact'::public.custom_role_scope)
) AS requested_scope(scope)
WHERE permission.code = 'REQUEST_INFO'::public.permission_code
ON CONFLICT (permission_id, scope) DO NOTHING;

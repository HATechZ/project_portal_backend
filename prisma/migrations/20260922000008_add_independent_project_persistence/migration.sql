-- Independent Module 09 Project persistence.  Historical `projects` remains
-- untouched as the combined workspace root; the direct Project domain expands
-- alongside it and is switched over only by a later explicit backfill plan.
--
-- Rollback: stop Module 09 writes, verify no direct-project rows need retention,
-- revoke grants/drop policies, remove the direct-project FK from name claims,
-- then drop these additive tables.  Enum rollback requires a type rebuild.

ALTER TYPE "workflow_action_code" ADD VALUE IF NOT EXISTS 'VIEW_PROJECT';
ALTER TYPE "workflow_action_code" ADD VALUE IF NOT EXISTS 'UPDATE_PROJECT';

CREATE TABLE "direct_project_statuses" (
  "id" UUID NOT NULL,
  "code" "project_status_code" NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_terminal" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "direct_project_statuses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "direct_project_statuses_code_key" UNIQUE ("code")
);

INSERT INTO "direct_project_statuses" ("id", "code", "name", "sort_order", "is_terminal")
VALUES (gen_random_uuid(), 'ACTIVE', 'Active', 0, false)
ON CONFLICT ("code") DO NOTHING;

CREATE TABLE "direct_projects" (
  "tenant_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "client_id" UUID NOT NULL,
  "name" VARCHAR(220) NOT NULL,
  "created_by_actor_id" UUID,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "direct_projects_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "direct_projects_id_tenant_id_key" UNIQUE ("id", "tenant_id"),
  CONSTRAINT "direct_projects_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "direct_projects_client_id_tenant_id_fkey" FOREIGN KEY ("client_id", "tenant_id") REFERENCES "clients"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "direct_projects_created_by_actor_id_tenant_id_fkey" FOREIGN KEY ("created_by_actor_id", "tenant_id") REFERENCES "actor_profiles"("id", "tenant_id") ON DELETE SET NULL ("created_by_actor_id") ON UPDATE CASCADE
);
CREATE INDEX "direct_projects_client_id_tenant_id_idx" ON "direct_projects"("client_id", "tenant_id");
CREATE INDEX "direct_projects_created_at_idx" ON "direct_projects"("created_at");
CREATE INDEX "direct_projects_tenant_id_idx" ON "direct_projects"("tenant_id");

CREATE TABLE "direct_project_status_events" (
  "tenant_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "direct_project_id" UUID NOT NULL,
  "from_status_id" UUID,
  "to_status_id" UUID NOT NULL,
  "changed_by_actor_id" UUID,
  "reason" TEXT,
  "occurred_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "direct_project_status_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "direct_project_status_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "direct_project_status_events_direct_project_id_tenant_id_fkey" FOREIGN KEY ("direct_project_id", "tenant_id") REFERENCES "direct_projects"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "direct_project_status_events_from_status_id_fkey" FOREIGN KEY ("from_status_id") REFERENCES "direct_project_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "direct_project_status_events_to_status_id_fkey" FOREIGN KEY ("to_status_id") REFERENCES "direct_project_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "direct_project_status_events_changed_by_actor_id_tenant_id_fkey" FOREIGN KEY ("changed_by_actor_id", "tenant_id") REFERENCES "actor_profiles"("id", "tenant_id") ON DELETE SET NULL ("changed_by_actor_id") ON UPDATE CASCADE
);
CREATE INDEX "direct_project_status_events_project_occurred_at_id_idx" ON "direct_project_status_events"("direct_project_id", "occurred_at" DESC, "id" DESC);
CREATE INDEX "direct_project_status_events_to_status_id_idx" ON "direct_project_status_events"("to_status_id");
CREATE INDEX "direct_project_status_events_tenant_id_idx" ON "direct_project_status_events"("tenant_id");

CREATE TABLE "direct_project_documents" (
  "tenant_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "direct_project_id" UUID NOT NULL,
  "document_code_option_id" UUID,
  "document_code_snapshot" VARCHAR(20),
  "original_file_name" VARCHAR(260) NOT NULL,
  "generated_file_name" VARCHAR(260),
  "storage_key" TEXT NOT NULL,
  "mime_type" VARCHAR(120) NOT NULL,
  "file_size_bytes" BIGINT NOT NULL,
  "revision_code" VARCHAR(20) NOT NULL DEFAULT 'A',
  "uploaded_by_actor_id" UUID NOT NULL,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "direct_project_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "direct_project_documents_id_tenant_id_key" UNIQUE ("id", "tenant_id"),
  CONSTRAINT "direct_project_documents_project_generated_file_name_key" UNIQUE ("direct_project_id", "generated_file_name"),
  CONSTRAINT "direct_project_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "direct_project_documents_project_id_tenant_id_fkey" FOREIGN KEY ("direct_project_id", "tenant_id") REFERENCES "direct_projects"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "direct_project_documents_document_code_option_id_tenant_id_fkey" FOREIGN KEY ("document_code_option_id", "tenant_id") REFERENCES "document_code_options"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "direct_project_documents_uploaded_by_actor_id_tenant_id_fkey" FOREIGN KEY ("uploaded_by_actor_id", "tenant_id") REFERENCES "actor_profiles"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "direct_project_documents_document_code_option_id_tenant_id_idx" ON "direct_project_documents"("document_code_option_id", "tenant_id");
CREATE INDEX "direct_project_documents_tenant_id_idx" ON "direct_project_documents"("tenant_id");

CREATE TABLE "direct_project_document_versions" (
  "tenant_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "direct_project_document_id" UUID NOT NULL,
  "version_number" INTEGER NOT NULL,
  "original_file_name" VARCHAR(260) NOT NULL,
  "generated_file_name" VARCHAR(260),
  "storage_key" TEXT NOT NULL,
  "mime_type" VARCHAR(120) NOT NULL,
  "file_size_bytes" BIGINT NOT NULL,
  "revision_code" VARCHAR(20) NOT NULL,
  "uploaded_by_actor_id" UUID NOT NULL,
  "uploaded_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "direct_project_document_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "direct_project_document_versions_id_tenant_id_key" UNIQUE ("id", "tenant_id"),
  CONSTRAINT "direct_project_document_versions_project_document_version_key" UNIQUE ("tenant_id", "direct_project_document_id", "version_number"),
  CONSTRAINT "direct_project_document_versions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "direct_project_document_versions_document_id_tenant_id_fkey" FOREIGN KEY ("direct_project_document_id", "tenant_id") REFERENCES "direct_project_documents"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "direct_project_document_versions_uploaded_by_actor_id_tenant_id_fkey" FOREIGN KEY ("uploaded_by_actor_id", "tenant_id") REFERENCES "actor_profiles"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "direct_project_document_versions_document_uploaded_at_idx" ON "direct_project_document_versions"("direct_project_document_id", "uploaded_at");
CREATE INDEX "direct_project_document_versions_tenant_id_idx" ON "direct_project_document_versions"("tenant_id");

CREATE TABLE "direct_project_document_classification_events" (
  "tenant_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "direct_project_document_id" UUID NOT NULL,
  "from_document_code_option_id" UUID,
  "to_document_code_option_id" UUID,
  "from_document_code_snapshot" VARCHAR(20),
  "to_document_code_snapshot" VARCHAR(20),
  "from_generated_file_name" VARCHAR(260),
  "to_generated_file_name" VARCHAR(260),
  "changed_by_actor_id" UUID NOT NULL,
  "occurred_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "direct_project_document_classification_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "direct_project_document_classification_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "direct_project_document_classification_events_document_id_tenant_id_fkey" FOREIGN KEY ("direct_project_document_id", "tenant_id") REFERENCES "direct_project_documents"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "direct_project_document_classification_events_from_code_id_tenant_id_fkey" FOREIGN KEY ("from_document_code_option_id", "tenant_id") REFERENCES "document_code_options"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "direct_project_document_classification_events_to_code_id_tenant_id_fkey" FOREIGN KEY ("to_document_code_option_id", "tenant_id") REFERENCES "document_code_options"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "direct_project_document_classification_events_actor_id_tenant_id_fkey" FOREIGN KEY ("changed_by_actor_id", "tenant_id") REFERENCES "actor_profiles"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "direct_project_document_classification_events_document_occurred_idx" ON "direct_project_document_classification_events"("direct_project_document_id", "occurred_at" DESC, "id" DESC);
CREATE INDEX "direct_project_document_classification_events_tenant_id_idx" ON "direct_project_document_classification_events"("tenant_id");

CREATE TABLE "direct_project_storage_cleanup_jobs" (
  "tenant_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "storage_key" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 1,
  "last_error" TEXT NOT NULL,
  "last_attempted_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "direct_project_storage_cleanup_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "direct_project_storage_cleanup_jobs_tenant_id_storage_key_key" UNIQUE ("tenant_id", "storage_key"),
  CONSTRAINT "direct_project_storage_cleanup_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "direct_project_storage_cleanup_jobs_created_at_idx" ON "direct_project_storage_cleanup_jobs"("created_at");
CREATE INDEX "direct_project_storage_cleanup_jobs_tenant_id_idx" ON "direct_project_storage_cleanup_jobs"("tenant_id");

ALTER TABLE "business_name_claims" ADD COLUMN "direct_project_id" UUID;
ALTER TABLE "business_name_claims" ADD CONSTRAINT "business_name_claims_direct_project_id_tenant_id_key" UNIQUE ("direct_project_id", "tenant_id");
ALTER TABLE "business_name_claims" ADD CONSTRAINT "business_name_claims_direct_project_id_tenant_id_fkey" FOREIGN KEY ("direct_project_id", "tenant_id") REFERENCES "direct_projects"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "business_name_claims" DROP CONSTRAINT "business_name_claims_exactly_one_owner_check";
ALTER TABLE "business_name_claims" ADD CONSTRAINT "business_name_claims_exactly_one_owner_check" CHECK (num_nonnulls("bid_id", "project_id", "direct_project_id") = 1);

ALTER TABLE "direct_projects" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_direct_projects ON "direct_projects" AS PERMISSIVE FOR ALL TO app_user USING ("tenant_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);
ALTER TABLE "direct_project_status_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_direct_project_status_events ON "direct_project_status_events" AS PERMISSIVE FOR ALL TO app_user USING ("tenant_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);
ALTER TABLE "direct_project_documents" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_direct_project_documents ON "direct_project_documents" AS PERMISSIVE FOR ALL TO app_user USING ("tenant_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);
ALTER TABLE "direct_project_document_versions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_direct_project_document_versions ON "direct_project_document_versions" AS PERMISSIVE FOR ALL TO app_user USING ("tenant_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);
ALTER TABLE "direct_project_document_classification_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_direct_project_document_classification_events ON "direct_project_document_classification_events" AS PERMISSIVE FOR ALL TO app_user USING ("tenant_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);
ALTER TABLE "direct_project_storage_cleanup_jobs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_direct_project_storage_cleanup_jobs ON "direct_project_storage_cleanup_jobs" AS PERMISSIVE FOR ALL TO app_user USING ("tenant_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

GRANT SELECT ON TABLE "direct_project_statuses" TO app_user;
GRANT SELECT, INSERT, UPDATE ON TABLE "direct_projects", "direct_project_status_events", "direct_project_documents", "direct_project_document_versions", "direct_project_document_classification_events" TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "direct_project_storage_cleanup_jobs" TO app_user;
GRANT SELECT, UPDATE, DELETE ON TABLE "direct_project_storage_cleanup_jobs" TO app_relay;

-- Module 10 V1 persistence is additive. Legacy work_requests and related
-- tables remain untouched. Rollback: stop V1 writes, preserve any rows that
-- must be retained, revoke grants/drop policies, then drop these tables in
-- dependency order. Enum rollback requires a PostgreSQL type rebuild.

CREATE TYPE "work_request_v1_priority_code" AS ENUM ('Low', 'Medium', 'High');
CREATE TYPE "work_request_v1_state_code" AS ENUM ('CREATED', 'DIVISION_ASSIGNED', 'TEAM_ASSIGNED', 'MEMBER_ASSIGNED', 'MEMBER_SUBMITTED', 'TEAM_LEAD_APPROVED', 'DIVISION_LEAD_APPROVED', 'DIVISION_HEAD_APPROVED');
CREATE TYPE "work_request_v1_assignment_level_code" AS ENUM ('DIVISION', 'TEAM', 'MEMBER');

ALTER TABLE "teams" ADD CONSTRAINT "teams_id_tenant_id_key" UNIQUE ("id", "tenant_id");

CREATE TABLE "work_requests_v1" (
  "tenant_id" UUID NOT NULL, "id" UUID NOT NULL, "bid_id" UUID, "direct_project_id" UUID,
  "title" VARCHAR(260) NOT NULL, "priority" "work_request_v1_priority_code" NOT NULL,
  "notes" TEXT, "created_by_actor_id" UUID NOT NULL,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "work_requests_v1_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "work_requests_v1_id_tenant_id_key" UNIQUE ("id", "tenant_id"),
  CONSTRAINT "work_requests_v1_exactly_one_parent_check" CHECK (num_nonnulls("bid_id", "direct_project_id") = 1),
  CONSTRAINT "work_requests_v1_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "work_requests_v1_bid_id_tenant_id_fkey" FOREIGN KEY ("bid_id", "tenant_id") REFERENCES "bids"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "work_requests_v1_direct_project_id_tenant_id_fkey" FOREIGN KEY ("direct_project_id", "tenant_id") REFERENCES "direct_projects"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "work_requests_v1_created_by_actor_id_tenant_id_fkey" FOREIGN KEY ("created_by_actor_id", "tenant_id") REFERENCES "actor_profiles"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "work_requests_v1_tenant_id_bid_id_idx" ON "work_requests_v1"("tenant_id", "bid_id");
CREATE INDEX "work_requests_v1_tenant_id_direct_project_id_idx" ON "work_requests_v1"("tenant_id", "direct_project_id");
CREATE INDEX "work_requests_v1_created_at_idx" ON "work_requests_v1"("created_at");

CREATE TABLE "work_request_v1_assignments" (
  "tenant_id" UUID NOT NULL, "id" UUID NOT NULL, "work_request_id" UUID NOT NULL,
  "level" "work_request_v1_assignment_level_code" NOT NULL, "division_id" UUID, "team_id" UUID, "member_id" UUID,
  "assigned_by_actor_id" UUID NOT NULL, "assigned_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "unassigned_at" TIMESTAMP(6), "replaced_at" TIMESTAMP(6), "note" TEXT,
  CONSTRAINT "work_request_v1_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "work_request_v1_assignments_id_tenant_id_key" UNIQUE ("id", "tenant_id"),
  CONSTRAINT "work_request_v1_assignments_level_target_check" CHECK (("level" = 'DIVISION' AND "division_id" IS NOT NULL AND "team_id" IS NULL AND "member_id" IS NULL) OR ("level" = 'TEAM' AND "division_id" IS NULL AND "team_id" IS NOT NULL AND "member_id" IS NULL) OR ("level" = 'MEMBER' AND "division_id" IS NULL AND "team_id" IS NULL AND "member_id" IS NOT NULL)),
  CONSTRAINT "work_request_v1_assignments_close_check" CHECK ("unassigned_at" IS NULL OR "replaced_at" IS NULL),
  CONSTRAINT "work_request_v1_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "work_request_v1_assignments_request_id_tenant_id_fkey" FOREIGN KEY ("work_request_id", "tenant_id") REFERENCES "work_requests_v1"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "work_request_v1_assignments_division_id_tenant_id_fkey" FOREIGN KEY ("division_id", "tenant_id") REFERENCES "divisions"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "work_request_v1_assignments_team_id_tenant_id_fkey" FOREIGN KEY ("team_id", "tenant_id") REFERENCES "teams"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "work_request_v1_assignments_member_id_tenant_id_fkey" FOREIGN KEY ("member_id", "tenant_id") REFERENCES "members"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "work_request_v1_assignments_actor_id_tenant_id_fkey" FOREIGN KEY ("assigned_by_actor_id", "tenant_id") REFERENCES "actor_profiles"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "work_request_v1_assignments_request_level_unassigned_idx" ON "work_request_v1_assignments"("work_request_id", "level", "unassigned_at");
CREATE UNIQUE INDEX "work_request_v1_assignments_one_active_level_key" ON "work_request_v1_assignments"("work_request_id", "level") WHERE "unassigned_at" IS NULL AND "replaced_at" IS NULL;
CREATE INDEX "work_request_v1_assignments_division_id_tenant_id_idx" ON "work_request_v1_assignments"("division_id", "tenant_id");
CREATE INDEX "work_request_v1_assignments_team_id_tenant_id_idx" ON "work_request_v1_assignments"("team_id", "tenant_id");
CREATE INDEX "work_request_v1_assignments_member_id_tenant_id_idx" ON "work_request_v1_assignments"("member_id", "tenant_id");

CREATE TABLE "work_request_v1_events" (
  "tenant_id" UUID NOT NULL, "id" UUID NOT NULL, "work_request_id" UUID NOT NULL,
  "action" VARCHAR(120) NOT NULL, "prior_state" "work_request_v1_state_code", "resulting_state" "work_request_v1_state_code",
  "performed_by_actor_id" UUID NOT NULL, "occurred_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" TEXT, "correlation_id" UUID, "idempotency_key" VARCHAR(160),
  CONSTRAINT "work_request_v1_events_pkey" PRIMARY KEY ("id"), CONSTRAINT "work_request_v1_events_id_tenant_id_key" UNIQUE ("id", "tenant_id"),
  CONSTRAINT "work_request_v1_events_tenant_id_idempotency_key_key" UNIQUE ("tenant_id", "idempotency_key"),
  CONSTRAINT "work_request_v1_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "work_request_v1_events_request_id_tenant_id_fkey" FOREIGN KEY ("work_request_id", "tenant_id") REFERENCES "work_requests_v1"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "work_request_v1_events_actor_id_tenant_id_fkey" FOREIGN KEY ("performed_by_actor_id", "tenant_id") REFERENCES "actor_profiles"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "work_request_v1_events_request_occurred_at_id_idx" ON "work_request_v1_events"("work_request_id", "occurred_at" DESC, "id" DESC);

CREATE TABLE "work_request_v1_documents" (
  "tenant_id" UUID NOT NULL, "id" UUID NOT NULL, "work_request_id" UUID NOT NULL, "document_code_id" UUID,
  "document_code_snapshot" VARCHAR(20), "original_file_name" VARCHAR(260) NOT NULL, "generated_file_name" VARCHAR(260),
  "storage_key" TEXT NOT NULL, "mime_type" VARCHAR(120) NOT NULL, "file_size_bytes" BIGINT NOT NULL,
  "revision_code" VARCHAR(20) NOT NULL DEFAULT 'A', "uploaded_by_actor_id" UUID NOT NULL,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "work_request_v1_documents_pkey" PRIMARY KEY ("id"), CONSTRAINT "work_request_v1_documents_id_tenant_id_key" UNIQUE ("id", "tenant_id"),
  CONSTRAINT "work_request_v1_documents_request_generated_file_name_key" UNIQUE ("work_request_id", "generated_file_name"),
  CONSTRAINT "work_request_v1_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "work_request_v1_documents_request_id_tenant_id_fkey" FOREIGN KEY ("work_request_id", "tenant_id") REFERENCES "work_requests_v1"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "work_request_v1_documents_document_code_id_tenant_id_fkey" FOREIGN KEY ("document_code_id", "tenant_id") REFERENCES "document_code_options"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "work_request_v1_documents_actor_id_tenant_id_fkey" FOREIGN KEY ("uploaded_by_actor_id", "tenant_id") REFERENCES "actor_profiles"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "work_request_v1_documents_document_code_id_tenant_id_idx" ON "work_request_v1_documents"("document_code_id", "tenant_id");

CREATE TABLE "work_request_v1_document_versions" (
  "tenant_id" UUID NOT NULL, "id" UUID NOT NULL, "work_request_v1_document_id" UUID NOT NULL, "version_number" INTEGER NOT NULL,
  "original_file_name" VARCHAR(260) NOT NULL, "generated_file_name" VARCHAR(260), "storage_key" TEXT NOT NULL,
  "mime_type" VARCHAR(120) NOT NULL, "file_size_bytes" BIGINT NOT NULL, "revision_code" VARCHAR(20) NOT NULL,
  "uploaded_by_actor_id" UUID NOT NULL, "uploaded_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "work_request_v1_document_versions_pkey" PRIMARY KEY ("id"), CONSTRAINT "work_request_v1_document_versions_id_tenant_id_key" UNIQUE ("id", "tenant_id"),
  CONSTRAINT "work_request_v1_document_versions_document_version_key" UNIQUE ("tenant_id", "work_request_v1_document_id", "version_number"),
  CONSTRAINT "work_request_v1_document_versions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "work_request_v1_document_versions_document_id_tenant_id_fkey" FOREIGN KEY ("work_request_v1_document_id", "tenant_id") REFERENCES "work_request_v1_documents"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "work_request_v1_document_versions_actor_id_tenant_id_fkey" FOREIGN KEY ("uploaded_by_actor_id", "tenant_id") REFERENCES "actor_profiles"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "work_request_v1_document_versions_document_uploaded_at_idx" ON "work_request_v1_document_versions"("work_request_v1_document_id", "uploaded_at");

CREATE TABLE "work_request_v1_document_classification_events" (
  "tenant_id" UUID NOT NULL, "id" UUID NOT NULL, "work_request_v1_document_id" UUID NOT NULL,
  "from_document_code_id" UUID, "to_document_code_id" UUID, "from_document_code_snapshot" VARCHAR(20), "to_document_code_snapshot" VARCHAR(20),
  "from_generated_file_name" VARCHAR(260), "to_generated_file_name" VARCHAR(260), "changed_by_actor_id" UUID NOT NULL,
  "occurred_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "work_request_v1_document_classification_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "work_request_v1_document_classification_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "work_request_v1_document_classification_events_document_id_tenant_id_fkey" FOREIGN KEY ("work_request_v1_document_id", "tenant_id") REFERENCES "work_request_v1_documents"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "work_request_v1_document_classification_events_from_code_id_tenant_id_fkey" FOREIGN KEY ("from_document_code_id", "tenant_id") REFERENCES "document_code_options"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "work_request_v1_document_classification_events_to_code_id_tenant_id_fkey" FOREIGN KEY ("to_document_code_id", "tenant_id") REFERENCES "document_code_options"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "work_request_v1_document_classification_events_actor_id_tenant_id_fkey" FOREIGN KEY ("changed_by_actor_id", "tenant_id") REFERENCES "actor_profiles"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "work_request_v1_document_classification_events_document_occurred_idx" ON "work_request_v1_document_classification_events"("work_request_v1_document_id", "occurred_at" DESC, "id" DESC);

CREATE TABLE "work_request_v1_info_requests" (
  "tenant_id" UUID NOT NULL, "id" UUID NOT NULL, "work_request_id" UUID NOT NULL, "requested_by_actor_id" UUID NOT NULL, "target_actor_id" UUID NOT NULL,
  "message" TEXT NOT NULL, "state_at_request" "work_request_v1_state_code" NOT NULL, "status" "info_request_status_code" NOT NULL DEFAULT 'OPEN',
  "requested_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "closed_at" TIMESTAMP(6),
  CONSTRAINT "work_request_v1_info_requests_pkey" PRIMARY KEY ("id"), CONSTRAINT "work_request_v1_info_requests_id_tenant_id_key" UNIQUE ("id", "tenant_id"),
  CONSTRAINT "work_request_v1_info_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "work_request_v1_info_requests_request_id_tenant_id_fkey" FOREIGN KEY ("work_request_id", "tenant_id") REFERENCES "work_requests_v1"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "work_request_v1_info_requests_requested_by_actor_id_tenant_id_fkey" FOREIGN KEY ("requested_by_actor_id", "tenant_id") REFERENCES "actor_profiles"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "work_request_v1_info_requests_target_actor_id_tenant_id_fkey" FOREIGN KEY ("target_actor_id", "tenant_id") REFERENCES "actor_profiles"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "work_request_v1_info_requests_request_requested_at_idx" ON "work_request_v1_info_requests"("work_request_id", "requested_at");
CREATE INDEX "work_request_v1_info_requests_target_actor_id_status_idx" ON "work_request_v1_info_requests"("target_actor_id", "status");

CREATE TABLE "work_request_v1_info_responses" (
  "tenant_id" UUID NOT NULL, "id" UUID NOT NULL, "info_request_id" UUID NOT NULL, "responded_by_actor_id" UUID NOT NULL,
  "message" TEXT NOT NULL, "responded_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "work_request_v1_info_responses_pkey" PRIMARY KEY ("id"), CONSTRAINT "work_request_v1_info_responses_id_tenant_id_key" UNIQUE ("id", "tenant_id"),
  CONSTRAINT "work_request_v1_info_responses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "work_request_v1_info_responses_info_request_id_tenant_id_fkey" FOREIGN KEY ("info_request_id", "tenant_id") REFERENCES "work_request_v1_info_requests"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "work_request_v1_info_responses_actor_id_tenant_id_fkey" FOREIGN KEY ("responded_by_actor_id", "tenant_id") REFERENCES "actor_profiles"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "work_request_v1_info_responses_request_responded_at_idx" ON "work_request_v1_info_responses"("info_request_id", "responded_at");

ALTER TABLE "work_requests_v1" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "work_request_v1_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "work_request_v1_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "work_request_v1_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "work_request_v1_document_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "work_request_v1_document_classification_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "work_request_v1_info_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "work_request_v1_info_responses" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_work_requests_v1 ON "work_requests_v1" AS PERMISSIVE FOR ALL TO app_user USING ("tenant_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY tenant_isolation_work_request_v1_assignments ON "work_request_v1_assignments" AS PERMISSIVE FOR ALL TO app_user USING ("tenant_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY tenant_isolation_work_request_v1_events ON "work_request_v1_events" AS PERMISSIVE FOR ALL TO app_user USING ("tenant_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY tenant_isolation_work_request_v1_documents ON "work_request_v1_documents" AS PERMISSIVE FOR ALL TO app_user USING ("tenant_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY tenant_isolation_work_request_v1_document_versions ON "work_request_v1_document_versions" AS PERMISSIVE FOR ALL TO app_user USING ("tenant_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY tenant_isolation_work_request_v1_document_classification_events ON "work_request_v1_document_classification_events" AS PERMISSIVE FOR ALL TO app_user USING ("tenant_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY tenant_isolation_work_request_v1_info_requests ON "work_request_v1_info_requests" AS PERMISSIVE FOR ALL TO app_user USING ("tenant_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY tenant_isolation_work_request_v1_info_responses ON "work_request_v1_info_responses" AS PERMISSIVE FOR ALL TO app_user USING ("tenant_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);
GRANT SELECT, INSERT, UPDATE ON TABLE "work_requests_v1", "work_request_v1_assignments", "work_request_v1_events", "work_request_v1_documents", "work_request_v1_document_versions", "work_request_v1_document_classification_events", "work_request_v1_info_requests", "work_request_v1_info_responses" TO app_user;

-- Add the generic external/client lifecycle for Work Request V1 without
-- changing historical workflow rows or generic review semantics.
--
-- Rollback: stop client-lifecycle writes, retain any required audit history,
-- drop the client-lifecycle tables and nullable event references, restore the
-- prior assignment target CHECK, then rebuild affected enum types without the
-- added values.

ALTER TYPE "work_request_v1_assignment_level_code" ADD VALUE IF NOT EXISTS 'EXTERNAL_REVIEW';

ALTER TYPE "work_request_v1_state_code" ADD VALUE IF NOT EXISTS 'CLIENT_REVIEW';
ALTER TYPE "work_request_v1_state_code" ADD VALUE IF NOT EXISTS 'ACCEPTED';
ALTER TYPE "work_request_v1_state_code" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "work_request_v1_state_code" ADD VALUE IF NOT EXISTS 'CLIENT_REVISION_REQUESTED';

ALTER TYPE "workflow_action_code" ADD VALUE IF NOT EXISTS 'WR_SUBMIT_CLIENT_REVIEW';
ALTER TYPE "workflow_action_code" ADD VALUE IF NOT EXISTS 'WR_CLIENT_ACCEPT';
ALTER TYPE "workflow_action_code" ADD VALUE IF NOT EXISTS 'WR_CLIENT_REJECT';
ALTER TYPE "workflow_action_code" ADD VALUE IF NOT EXISTS 'WR_CLIENT_REQUEST_REVISION';
ALTER TYPE "workflow_action_code" ADD VALUE IF NOT EXISTS 'WR_ROUTE_CLIENT_REVISION';

CREATE TYPE "work_request_v1_client_decision_code" AS ENUM ('ACCEPT', 'REJECT', 'REQUEST_REVISION');

ALTER TABLE "work_request_v1_events"
  ADD COLUMN "client_submission_id" UUID,
  ADD COLUMN "client_decision_id" UUID;

ALTER TABLE "work_request_v1_assignments"
  DROP CONSTRAINT "work_request_v1_assignments_level_target_check",
  ADD CONSTRAINT "work_request_v1_assignments_level_target_check" CHECK (
    ("level"::text = 'DIVISION' AND "division_id" IS NOT NULL AND "team_id" IS NULL AND "member_id" IS NULL)
    OR ("level"::text = 'TEAM' AND "division_id" IS NULL AND "team_id" IS NOT NULL AND "member_id" IS NULL)
    OR ("level"::text IN ('MEMBER', 'CHECKING', 'APPROVAL', 'FINAL_REVIEW', 'EXTERNAL_REVIEW')
      AND "division_id" IS NULL AND "team_id" IS NULL AND "member_id" IS NOT NULL)
  );

CREATE TABLE "work_request_v1_client_submissions" (
  "tenant_id" UUID NOT NULL, "id" UUID NOT NULL, "work_request_id" UUID NOT NULL,
  "submission_number" INTEGER NOT NULL, "created_by_actor_id" UUID NOT NULL,
  "submitted_by_actor_id" UUID NOT NULL,
  "submitted_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "correlation_id" UUID, "idempotency_key" VARCHAR(160),
  CONSTRAINT "work_request_v1_client_submissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "work_request_v1_client_submissions_id_tenant_id_key" UNIQUE ("id", "tenant_id"),
  CONSTRAINT "work_request_v1_client_submissions_tenant_request_number_key" UNIQUE ("tenant_id", "work_request_id", "submission_number"),
  CONSTRAINT "work_request_v1_client_submissions_tenant_idempotency_key_key" UNIQUE ("tenant_id", "idempotency_key"),
  CONSTRAINT "work_request_v1_client_submissions_number_check" CHECK ("submission_number" > 0),
  CONSTRAINT "work_request_v1_client_submissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "work_request_v1_client_submissions_request_id_tenant_id_fkey" FOREIGN KEY ("work_request_id", "tenant_id") REFERENCES "work_requests_v1"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "wr_v1_client_submissions_created_actor_tenant_fk" FOREIGN KEY ("created_by_actor_id", "tenant_id") REFERENCES "actor_profiles"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "wr_v1_client_submissions_submitted_actor_tenant_fk" FOREIGN KEY ("submitted_by_actor_id", "tenant_id") REFERENCES "actor_profiles"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "work_request_v1_client_submissions_request_submitted_at_idx" ON "work_request_v1_client_submissions"("work_request_id", "submitted_at" DESC, "id" DESC);

CREATE TABLE "work_request_v1_client_submission_items" (
  "tenant_id" UUID NOT NULL, "id" UUID NOT NULL, "submission_id" UUID NOT NULL,
  "document_version_id" UUID NOT NULL, "position" INTEGER NOT NULL,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "work_request_v1_client_submission_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "work_request_v1_client_submission_items_id_tenant_id_key" UNIQUE ("id", "tenant_id"),
  CONSTRAINT "work_request_v1_client_submission_items_submission_position_key" UNIQUE ("tenant_id", "submission_id", "position"),
  CONSTRAINT "work_request_v1_client_submission_items_sub_doc_ver_key" UNIQUE ("tenant_id", "submission_id", "document_version_id"),
  CONSTRAINT "work_request_v1_client_submission_items_position_check" CHECK ("position" >= 0),
  CONSTRAINT "work_request_v1_client_submission_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "wr_v1_client_submission_items_submission_tenant_fk" FOREIGN KEY ("submission_id", "tenant_id") REFERENCES "work_request_v1_client_submissions"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "wr_v1_client_submission_items_document_version_tenant_fk" FOREIGN KEY ("document_version_id", "tenant_id") REFERENCES "work_request_v1_document_versions"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "wr_v1_client_submission_items_document_version_tenant_idx" ON "work_request_v1_client_submission_items"("document_version_id", "tenant_id");

CREATE TABLE "work_request_v1_client_decisions" (
  "tenant_id" UUID NOT NULL, "id" UUID NOT NULL, "work_request_id" UUID NOT NULL,
  "submission_id" UUID NOT NULL, "decision" "work_request_v1_client_decision_code" NOT NULL,
  "decided_by_actor_id" UUID NOT NULL, "note" TEXT,
  "decided_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "correlation_id" UUID, "idempotency_key" VARCHAR(160),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "work_request_v1_client_decisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "work_request_v1_client_decisions_id_tenant_id_key" UNIQUE ("id", "tenant_id"),
  CONSTRAINT "work_request_v1_client_decisions_tenant_submission_key" UNIQUE ("submission_id", "tenant_id"),
  CONSTRAINT "work_request_v1_client_decisions_tenant_idempotency_key_key" UNIQUE ("tenant_id", "idempotency_key"),
  CONSTRAINT "work_request_v1_client_decisions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "work_request_v1_client_decisions_request_id_tenant_id_fkey" FOREIGN KEY ("work_request_id", "tenant_id") REFERENCES "work_requests_v1"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "work_request_v1_client_decisions_submission_id_tenant_id_fkey" FOREIGN KEY ("submission_id", "tenant_id") REFERENCES "work_request_v1_client_submissions"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "work_request_v1_client_decisions_actor_id_tenant_id_fkey" FOREIGN KEY ("decided_by_actor_id", "tenant_id") REFERENCES "actor_profiles"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "work_request_v1_client_decisions_request_decided_at_idx" ON "work_request_v1_client_decisions"("work_request_id", "decided_at" DESC, "id" DESC);

ALTER TABLE "work_request_v1_events"
  ADD CONSTRAINT "work_request_v1_events_client_submission_id_tenant_id_fkey" FOREIGN KEY ("client_submission_id", "tenant_id") REFERENCES "work_request_v1_client_submissions"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "work_request_v1_events_client_decision_id_tenant_id_fkey" FOREIGN KEY ("client_decision_id", "tenant_id") REFERENCES "work_request_v1_client_decisions"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "work_request_v1_events_client_submission_id_tenant_id_idx" ON "work_request_v1_events"("client_submission_id", "tenant_id");
CREATE INDEX "work_request_v1_events_client_decision_id_tenant_id_idx" ON "work_request_v1_events"("client_decision_id", "tenant_id");

ALTER TABLE "work_request_v1_client_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "work_request_v1_client_submission_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "work_request_v1_client_decisions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_work_request_v1_client_submissions ON "work_request_v1_client_submissions" AS PERMISSIVE FOR ALL TO app_user USING ("tenant_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY tenant_isolation_work_request_v1_client_submission_items ON "work_request_v1_client_submission_items" AS PERMISSIVE FOR ALL TO app_user USING ("tenant_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);
CREATE POLICY tenant_isolation_work_request_v1_client_decisions ON "work_request_v1_client_decisions" AS PERMISSIVE FOR ALL TO app_user USING ("tenant_id" = current_setting('app.tenant_id')::uuid) WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);
GRANT SELECT, INSERT, UPDATE ON TABLE "work_request_v1_client_submissions", "work_request_v1_client_submission_items", "work_request_v1_client_decisions" TO app_user;

-- PREPARED ONLY. Owner must apply after the revision-resubmission runtime is ready.
-- This is additive: existing route revisions, normal Member submissions, events,
-- and document versions remain untouched.
CREATE TABLE "work_request_route_revision_submissions" (
  "tenant_id" UUID NOT NULL, "id" UUID NOT NULL, "route_id" UUID NOT NULL,
  "work_request_id" UUID NOT NULL, "revision_id" UUID NOT NULL,
  "submitted_by_actor_id" UUID NOT NULL, "note" TEXT,
  "submitted_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  UNIQUE ("id", "tenant_id"),
  UNIQUE ("tenant_id", "revision_id"),
  UNIQUE ("revision_id", "tenant_id", "route_id"),
  UNIQUE ("id", "tenant_id", "work_request_id"),
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("route_id", "tenant_id", "work_request_id") REFERENCES "work_request_routes"("id", "tenant_id", "work_request_id") ON DELETE RESTRICT,
  FOREIGN KEY ("revision_id", "tenant_id", "route_id") REFERENCES "work_request_route_revisions"("id", "tenant_id", "route_id") ON DELETE RESTRICT,
  FOREIGN KEY ("submitted_by_actor_id", "tenant_id") REFERENCES "actor_profiles"("id", "tenant_id") ON DELETE RESTRICT
);
CREATE INDEX "wr_route_revision_submissions_route_submitted_idx"
  ON "work_request_route_revision_submissions"("tenant_id", "route_id", "submitted_at");

CREATE TABLE "work_request_route_revision_submission_documents" (
  "tenant_id" UUID NOT NULL, "id" UUID NOT NULL, "submission_id" UUID NOT NULL,
  "document_version_id" UUID NOT NULL, "position" INTEGER NOT NULL,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  UNIQUE ("id", "tenant_id"),
  UNIQUE ("tenant_id", "submission_id", "document_version_id"),
  UNIQUE ("tenant_id", "submission_id", "position"),
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("submission_id", "tenant_id") REFERENCES "work_request_route_revision_submissions"("id", "tenant_id") ON DELETE RESTRICT,
  FOREIGN KEY ("document_version_id", "tenant_id") REFERENCES "work_request_v1_document_versions"("id", "tenant_id") ON DELETE RESTRICT,
  CHECK ("position" >= 0)
);
CREATE INDEX "wr_route_revision_submission_documents_version_idx"
  ON "work_request_route_revision_submission_documents"("tenant_id", "document_version_id");

CREATE TRIGGER "wr_route_revision_submissions_immutable"
  BEFORE UPDATE OR DELETE ON "work_request_route_revision_submissions"
  FOR EACH ROW EXECUTE FUNCTION prevent_work_request_route_history_mutation();
CREATE TRIGGER "wr_route_revision_submission_documents_immutable"
  BEFORE UPDATE OR DELETE ON "work_request_route_revision_submission_documents"
  FOR EACH ROW EXECUTE FUNCTION prevent_work_request_route_history_mutation();

ALTER TABLE "work_request_route_revision_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "work_request_route_revision_submission_documents" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_work_request_route_revision_submissions"
  ON "work_request_route_revision_submissions" AS PERMISSIVE FOR ALL TO app_user
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY "tenant_isolation_work_request_route_revision_submission_documents"
  ON "work_request_route_revision_submission_documents" AS PERMISSIVE FOR ALL TO app_user
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
GRANT SELECT, INSERT ON TABLE "work_request_route_revision_submissions", "work_request_route_revision_submission_documents" TO app_user;

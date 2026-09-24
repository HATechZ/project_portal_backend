-- Durable compensation for Work Request binaries that cannot be deleted after
-- the enclosing WorkRequestV1 transaction rolls back.
CREATE TABLE "work_request_storage_cleanup_jobs" (
  "tenant_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "storage_key" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 1,
  "last_error" TEXT NOT NULL,
  "last_attempted_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "work_request_storage_cleanup_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "work_request_storage_cleanup_jobs_tenant_id_storage_key_key" UNIQUE ("tenant_id", "storage_key"),
  CONSTRAINT "work_request_storage_cleanup_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "work_request_storage_cleanup_jobs_created_at_idx" ON "work_request_storage_cleanup_jobs"("created_at");
CREATE INDEX "work_request_storage_cleanup_jobs_tenant_id_idx" ON "work_request_storage_cleanup_jobs"("tenant_id");
ALTER TABLE "work_request_storage_cleanup_jobs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_work_request_storage_cleanup_jobs ON "work_request_storage_cleanup_jobs"
  AS PERMISSIVE FOR ALL TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "work_request_storage_cleanup_jobs" TO app_user;
GRANT SELECT, UPDATE, DELETE ON TABLE "work_request_storage_cleanup_jobs" TO app_relay;

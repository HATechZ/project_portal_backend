-- Durable compensation queue for Bid binaries that were stored under ./uploads
-- but whose enclosing database transaction did not commit. The job intentionally
-- has no bid_document foreign key: it records an orphan, never a valid document.
--
-- Rollback: stop the cleanup worker, verify there are no pending rows (or delete
-- their corresponding local objects manually), revoke the grants/policy, then
-- DROP TABLE "bid_storage_cleanup_jobs". This migration is additive only.

CREATE TABLE "bid_storage_cleanup_jobs" (
  "tenant_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "storage_key" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 1,
  "last_error" TEXT NOT NULL,
  "last_attempted_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "bid_storage_cleanup_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bid_storage_cleanup_jobs_tenant_id_storage_key_key" UNIQUE ("tenant_id", "storage_key"),
  CONSTRAINT "bid_storage_cleanup_jobs_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "bid_storage_cleanup_jobs_created_at_idx"
  ON "bid_storage_cleanup_jobs"("created_at");
CREATE INDEX "bid_storage_cleanup_jobs_tenant_id_idx"
  ON "bid_storage_cleanup_jobs"("tenant_id");

ALTER TABLE "bid_storage_cleanup_jobs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_bid_storage_cleanup_jobs ON "bid_storage_cleanup_jobs"
  AS PERMISSIVE FOR ALL TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

-- The request path persists the failed cleanup using app_user. The background
-- retry has no request tenant, so its narrowly scoped app_relay path may drain
-- and remove resolved jobs across tenants, just as it does for the outbox.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "bid_storage_cleanup_jobs" TO app_user;
GRANT SELECT, UPDATE, DELETE ON TABLE "bid_storage_cleanup_jobs" TO app_relay;

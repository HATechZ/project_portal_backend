-- Expand the independent Bid persistence boundary. This migration intentionally
-- leaves the legacy Project/BidDetail path intact; no legacy rows are backfilled
-- or reinterpreted here. A later, separately approved Project reshape owns that
-- data migration and the legacy-table contract step.
--
-- Rollback: drop the RLS policies and the six new tables in dependency order;
-- revoke the grants below; then drop the three composite unique constraints only
-- after confirming no later tenant-qualified foreign key depends on them. The
-- bid_status_code enum cannot be dropped directly; rebuild it only before any
-- dependent rows exist, following the repository's enum rollback convention.

CREATE TYPE "bid_status_code" AS ENUM ('BIDDING');

ALTER TABLE "clients"
  ADD CONSTRAINT "clients_id_tenant_id_key" UNIQUE ("id", "tenant_id");
ALTER TABLE "option_values"
  ADD CONSTRAINT "option_values_id_tenant_id_key" UNIQUE ("id", "tenant_id");
ALTER TABLE "document_code_options"
  ADD CONSTRAINT "document_code_options_id_tenant_id_key" UNIQUE ("id", "tenant_id");

CREATE TABLE "bid_statuses" (
  "id" UUID NOT NULL,
  "code" "bid_status_code" NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_terminal" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "bid_statuses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "bid_statuses_code_key" ON "bid_statuses"("code");

INSERT INTO "bid_statuses" ("id", "code", "name", "sort_order", "is_terminal")
VALUES (gen_random_uuid(), 'BIDDING', 'Bidding', 0, false);

CREATE TABLE "bids" (
  "tenant_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "client_id" UUID NOT NULL,
  "name" VARCHAR(220) NOT NULL,
  "project_code" VARCHAR(40) NOT NULL,
  "bidding_number" VARCHAR(60) NOT NULL,
  "shipment_number" VARCHAR(10) NOT NULL,
  "pol_option_id" UUID NOT NULL,
  "pod_option_id" UUID NOT NULL,
  "cargo_code_option_id" UUID NOT NULL,
  "vessel_code_option_id" UUID NOT NULL,
  "pol_name_snapshot" VARCHAR(180) NOT NULL,
  "pod_name_snapshot" VARCHAR(180) NOT NULL,
  "cargo_code_snapshot" VARCHAR(40) NOT NULL,
  "vessel_code_snapshot" VARCHAR(40) NOT NULL,
  "created_by_actor_id" UUID,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bids_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bids_id_tenant_id_key" UNIQUE ("id", "tenant_id"),
  CONSTRAINT "bids_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bids_client_id_tenant_id_fkey" FOREIGN KEY ("client_id", "tenant_id") REFERENCES "clients"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bids_pol_option_id_tenant_id_fkey" FOREIGN KEY ("pol_option_id", "tenant_id") REFERENCES "option_values"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bids_pod_option_id_tenant_id_fkey" FOREIGN KEY ("pod_option_id", "tenant_id") REFERENCES "option_values"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bids_cargo_code_option_id_tenant_id_fkey" FOREIGN KEY ("cargo_code_option_id", "tenant_id") REFERENCES "option_values"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bids_vessel_code_option_id_tenant_id_fkey" FOREIGN KEY ("vessel_code_option_id", "tenant_id") REFERENCES "option_values"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bids_created_by_actor_id_tenant_id_fkey" FOREIGN KEY ("created_by_actor_id", "tenant_id") REFERENCES "actor_profiles"("id", "tenant_id") ON DELETE SET NULL ("created_by_actor_id") ON UPDATE CASCADE
);
CREATE INDEX "bids_client_id_tenant_id_idx" ON "bids"("client_id", "tenant_id");
CREATE INDEX "bids_created_at_idx" ON "bids"("created_at");
CREATE INDEX "bids_tenant_id_idx" ON "bids"("tenant_id");

CREATE TABLE "bid_status_events" (
  "tenant_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "bid_id" UUID NOT NULL,
  "from_status_id" UUID,
  "to_status_id" UUID NOT NULL,
  "changed_by_actor_id" UUID,
  "reason" TEXT,
  "occurred_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bid_status_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bid_status_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bid_status_events_bid_id_tenant_id_fkey" FOREIGN KEY ("bid_id", "tenant_id") REFERENCES "bids"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bid_status_events_from_status_id_fkey" FOREIGN KEY ("from_status_id") REFERENCES "bid_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bid_status_events_to_status_id_fkey" FOREIGN KEY ("to_status_id") REFERENCES "bid_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bid_status_events_changed_by_actor_id_tenant_id_fkey" FOREIGN KEY ("changed_by_actor_id", "tenant_id") REFERENCES "actor_profiles"("id", "tenant_id") ON DELETE SET NULL ("changed_by_actor_id") ON UPDATE CASCADE
);
CREATE INDEX "bid_status_events_bid_id_occurred_at_id_idx" ON "bid_status_events"("bid_id", "occurred_at" DESC, "id" DESC);
CREATE INDEX "bid_status_events_to_status_id_idx" ON "bid_status_events"("to_status_id");
CREATE INDEX "bid_status_events_tenant_id_idx" ON "bid_status_events"("tenant_id");

CREATE TABLE "bid_documents" (
  "tenant_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "bid_id" UUID NOT NULL,
  "document_code_option_id" UUID NOT NULL,
  "document_code_snapshot" VARCHAR(20) NOT NULL,
  "original_file_name" VARCHAR(260) NOT NULL,
  "generated_file_name" VARCHAR(260) NOT NULL,
  "storage_key" TEXT NOT NULL,
  "mime_type" VARCHAR(120) NOT NULL,
  "file_size_bytes" BIGINT NOT NULL,
  "revision_code" VARCHAR(20) NOT NULL DEFAULT 'A',
  "uploaded_by_actor_id" UUID NOT NULL,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bid_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bid_documents_id_tenant_id_key" UNIQUE ("id", "tenant_id"),
  CONSTRAINT "bid_documents_bid_id_generated_file_name_key" UNIQUE ("bid_id", "generated_file_name"),
  CONSTRAINT "bid_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bid_documents_bid_id_tenant_id_fkey" FOREIGN KEY ("bid_id", "tenant_id") REFERENCES "bids"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bid_documents_document_code_option_id_tenant_id_fkey" FOREIGN KEY ("document_code_option_id", "tenant_id") REFERENCES "document_code_options"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bid_documents_uploaded_by_actor_id_tenant_id_fkey" FOREIGN KEY ("uploaded_by_actor_id", "tenant_id") REFERENCES "actor_profiles"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "bid_documents_document_code_option_id_tenant_id_idx" ON "bid_documents"("document_code_option_id", "tenant_id");
CREATE INDEX "bid_documents_tenant_id_idx" ON "bid_documents"("tenant_id");

CREATE TABLE "bid_document_versions" (
  "tenant_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "bid_document_id" UUID NOT NULL,
  "version_number" INTEGER NOT NULL,
  "original_file_name" VARCHAR(260) NOT NULL,
  "generated_file_name" VARCHAR(260) NOT NULL,
  "storage_key" TEXT NOT NULL,
  "mime_type" VARCHAR(120) NOT NULL,
  "file_size_bytes" BIGINT NOT NULL,
  "revision_code" VARCHAR(20) NOT NULL,
  "uploaded_by_actor_id" UUID NOT NULL,
  "uploaded_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bid_document_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bid_document_versions_id_tenant_id_key" UNIQUE ("id", "tenant_id"),
  CONSTRAINT "bid_document_versions_tenant_id_bid_document_id_version_number_key" UNIQUE ("tenant_id", "bid_document_id", "version_number"),
  CONSTRAINT "bid_document_versions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bid_document_versions_bid_document_id_tenant_id_fkey" FOREIGN KEY ("bid_document_id", "tenant_id") REFERENCES "bid_documents"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bid_document_versions_uploaded_by_actor_id_tenant_id_fkey" FOREIGN KEY ("uploaded_by_actor_id", "tenant_id") REFERENCES "actor_profiles"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "bid_document_versions_bid_document_id_uploaded_at_idx" ON "bid_document_versions"("bid_document_id", "uploaded_at");
CREATE INDEX "bid_document_versions_tenant_id_idx" ON "bid_document_versions"("tenant_id");

CREATE TABLE "bid_document_classification_events" (
  "tenant_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "bid_document_id" UUID NOT NULL,
  "from_document_code_option_id" UUID NOT NULL,
  "to_document_code_option_id" UUID NOT NULL,
  "from_document_code_snapshot" VARCHAR(20) NOT NULL,
  "to_document_code_snapshot" VARCHAR(20) NOT NULL,
  "from_generated_file_name" VARCHAR(260) NOT NULL,
  "to_generated_file_name" VARCHAR(260) NOT NULL,
  "changed_by_actor_id" UUID NOT NULL,
  "occurred_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bid_document_classification_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bid_document_classification_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bid_document_classification_events_bid_document_id_tenant_id_fkey" FOREIGN KEY ("bid_document_id", "tenant_id") REFERENCES "bid_documents"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bid_document_classification_events_from_document_code_option_id_tenant_id_fkey" FOREIGN KEY ("from_document_code_option_id", "tenant_id") REFERENCES "document_code_options"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bid_document_classification_events_to_document_code_option_id_tenant_id_fkey" FOREIGN KEY ("to_document_code_option_id", "tenant_id") REFERENCES "document_code_options"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bid_document_classification_events_changed_by_actor_id_tenant_id_fkey" FOREIGN KEY ("changed_by_actor_id", "tenant_id") REFERENCES "actor_profiles"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "bid_document_classification_events_bid_document_id_occurred_at_id_idx" ON "bid_document_classification_events"("bid_document_id", "occurred_at" DESC, "id" DESC);
CREATE INDEX "bid_document_classification_events_tenant_id_idx" ON "bid_document_classification_events"("tenant_id");

CREATE TABLE "business_name_claims" (
  "tenant_id" UUID NOT NULL,
  "id" UUID NOT NULL,
  "normalized_name" VARCHAR(220) NOT NULL,
  "bid_id" UUID,
  "project_id" UUID,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "business_name_claims_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "business_name_claims_id_tenant_id_key" UNIQUE ("id", "tenant_id"),
  CONSTRAINT "business_name_claims_bid_id_tenant_id_key" UNIQUE ("bid_id", "tenant_id"),
  CONSTRAINT "business_name_claims_project_id_tenant_id_key" UNIQUE ("project_id", "tenant_id"),
  CONSTRAINT "business_name_claims_tenant_id_normalized_name_key" UNIQUE ("tenant_id", "normalized_name"),
  CONSTRAINT "business_name_claims_exactly_one_owner_check" CHECK (num_nonnulls("bid_id", "project_id") = 1),
  CONSTRAINT "business_name_claims_normalized_name_check" CHECK ("normalized_name" = lower(btrim("normalized_name")) AND "normalized_name" <> ''),
  CONSTRAINT "business_name_claims_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "business_name_claims_bid_id_tenant_id_fkey" FOREIGN KEY ("bid_id", "tenant_id") REFERENCES "bids"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "business_name_claims_project_id_tenant_id_fkey" FOREIGN KEY ("project_id", "tenant_id") REFERENCES "projects"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "business_name_claims_tenant_id_idx" ON "business_name_claims"("tenant_id");

ALTER TABLE "bids" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_bids ON "bids"
  AS PERMISSIVE FOR ALL TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "bid_status_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_bid_status_events ON "bid_status_events"
  AS PERMISSIVE FOR ALL TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "bid_documents" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_bid_documents ON "bid_documents"
  AS PERMISSIVE FOR ALL TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "bid_document_versions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_bid_document_versions ON "bid_document_versions"
  AS PERMISSIVE FOR ALL TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "bid_document_classification_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_bid_document_classification_events ON "bid_document_classification_events"
  AS PERMISSIVE FOR ALL TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "business_name_claims" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_business_name_claims ON "business_name_claims"
  AS PERMISSIVE FOR ALL TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

GRANT SELECT ON TABLE "bid_statuses" TO app_user;
GRANT SELECT, INSERT, UPDATE ON TABLE "bids", "bid_status_events", "bid_documents", "bid_document_versions", "bid_document_classification_events", "business_name_claims" TO app_user;

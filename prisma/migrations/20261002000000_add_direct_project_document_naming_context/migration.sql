-- Expand Direct Project naming inputs and the shared document metadata shape.
-- All columns are nullable so existing direct projects and historical document
-- records retain their known facts without fabricated naming context. New
-- application writes must provide the required Direct Project references and
-- snapshots before generating an official filename.
--
-- Rollback: drop the four Direct Project foreign-key constraints, then drop
-- the columns added below. No backfill is performed, so rollback does not
-- discard derived or inferred historical values.

ALTER TABLE "direct_projects"
  ADD COLUMN "project_code" VARCHAR(40),
  ADD COLUMN "pol_id" UUID,
  ADD COLUMN "pod_id" UUID,
  ADD COLUMN "cargo_id" UUID,
  ADD COLUMN "vessel_id" UUID,
  ADD COLUMN "pol_name_snapshot" VARCHAR(180),
  ADD COLUMN "pod_name_snapshot" VARCHAR(180),
  ADD COLUMN "cargo_code_snapshot" VARCHAR(40),
  ADD COLUMN "vessel_code_snapshot" VARCHAR(40);

ALTER TABLE "direct_projects"
  ADD CONSTRAINT "direct_projects_pol_id_tenant_id_fkey"
    FOREIGN KEY ("pol_id", "tenant_id") REFERENCES "option_values"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "direct_projects_pod_id_tenant_id_fkey"
    FOREIGN KEY ("pod_id", "tenant_id") REFERENCES "option_values"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "direct_projects_cargo_id_tenant_id_fkey"
    FOREIGN KEY ("cargo_id", "tenant_id") REFERENCES "option_values"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "direct_projects_vessel_id_tenant_id_fkey"
    FOREIGN KEY ("vessel_id", "tenant_id") REFERENCES "option_values"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bid_documents"
  ADD COLUMN "document_name_snapshot" VARCHAR(180);

ALTER TABLE "direct_project_documents"
  ADD COLUMN "document_name_snapshot" VARCHAR(180);

ALTER TABLE "work_request_v1_documents"
  ADD COLUMN "document_name_snapshot" VARCHAR(180);

ALTER TABLE "bid_document_versions"
  ADD COLUMN "uploaded_file_name" VARCHAR(260);

ALTER TABLE "direct_project_document_versions"
  ADD COLUMN "uploaded_file_name" VARCHAR(260);

ALTER TABLE "work_request_v1_document_versions"
  ADD COLUMN "uploaded_file_name" VARCHAR(260);

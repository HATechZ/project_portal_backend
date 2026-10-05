-- Generated filenames are immutable display facts, not logical document identity.
-- Phase 2 allows multiple new documents on the same parent to share an approved
-- generated filename; each document/version/storage key remains independently
-- identified. Retain non-unique lookup indexes for parent-scoped reads.
--
-- Rollback: after proving that each parent has no duplicate generated filename,
-- drop the three non-unique indexes and recreate the original unique constraints.

ALTER TABLE "bid_documents"
  DROP CONSTRAINT "bid_documents_bid_id_generated_file_name_key";

ALTER TABLE "direct_project_documents"
  DROP CONSTRAINT "direct_project_documents_project_generated_file_name_key";

ALTER TABLE "work_request_v1_documents"
  DROP CONSTRAINT "work_request_v1_documents_request_generated_file_name_key";

CREATE INDEX "bid_documents_bid_id_generated_file_name_idx"
  ON "bid_documents"("bid_id", "generated_file_name");

CREATE INDEX "direct_project_documents_project_generated_file_name_idx"
  ON "direct_project_documents"("direct_project_id", "generated_file_name");

CREATE INDEX "work_request_v1_documents_request_generated_file_name_idx"
  ON "work_request_v1_documents"("work_request_id", "generated_file_name");

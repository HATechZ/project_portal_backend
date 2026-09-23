-- Rename public/business reference identifiers while retaining OptionValue and
-- DocumentCodeOption as the persistence architecture.
--
-- Rollback: reverse each RENAME COLUMN / RENAME CONSTRAINT / RENAME INDEX below
-- in reverse order. The operations preserve values, types, foreign-key targets,
-- indexes, RLS policies, grants, functions, and triggers.

ALTER TABLE "bid_details" RENAME COLUMN "pol_option_id" TO "pol_id";
ALTER TABLE "bid_details" RENAME COLUMN "pod_option_id" TO "pod_id";
ALTER TABLE "bid_details" RENAME COLUMN "cargo_code_option_id" TO "cargo_id";
ALTER TABLE "bid_details" RENAME COLUMN "vessel_code_option_id" TO "vessel_id";
ALTER TABLE "bid_details" RENAME CONSTRAINT "bid_details_pol_option_id_fkey" TO "bid_details_pol_id_fkey";
ALTER TABLE "bid_details" RENAME CONSTRAINT "bid_details_pod_option_id_fkey" TO "bid_details_pod_id_fkey";
ALTER TABLE "bid_details" RENAME CONSTRAINT "bid_details_cargo_code_option_id_fkey" TO "bid_details_cargo_id_fkey";
ALTER TABLE "bid_details" RENAME CONSTRAINT "bid_details_vessel_code_option_id_fkey" TO "bid_details_vessel_id_fkey";

ALTER TABLE "documents" RENAME COLUMN "document_code_option_id" TO "document_code_id";
ALTER TABLE "documents" RENAME CONSTRAINT "documents_document_code_option_id_fkey" TO "documents_document_code_id_fkey";
ALTER INDEX "documents_document_code_option_id_idx" RENAME TO "documents_document_code_id_idx";

ALTER TABLE "bids" RENAME COLUMN "pol_option_id" TO "pol_id";
ALTER TABLE "bids" RENAME COLUMN "pod_option_id" TO "pod_id";
ALTER TABLE "bids" RENAME COLUMN "cargo_code_option_id" TO "cargo_id";
ALTER TABLE "bids" RENAME COLUMN "vessel_code_option_id" TO "vessel_id";
ALTER TABLE "bids" RENAME CONSTRAINT "bids_pol_option_id_tenant_id_fkey" TO "bids_pol_id_tenant_id_fkey";
ALTER TABLE "bids" RENAME CONSTRAINT "bids_pod_option_id_tenant_id_fkey" TO "bids_pod_id_tenant_id_fkey";
ALTER TABLE "bids" RENAME CONSTRAINT "bids_cargo_code_option_id_tenant_id_fkey" TO "bids_cargo_id_tenant_id_fkey";
ALTER TABLE "bids" RENAME CONSTRAINT "bids_vessel_code_option_id_tenant_id_fkey" TO "bids_vessel_id_tenant_id_fkey";

ALTER TABLE "bid_documents" RENAME COLUMN "document_code_option_id" TO "document_code_id";
ALTER TABLE "bid_documents" RENAME CONSTRAINT "bid_documents_document_code_option_id_tenant_id_fkey" TO "bid_documents_document_code_id_tenant_id_fkey";
ALTER INDEX "bid_documents_document_code_option_id_tenant_id_idx" RENAME TO "bid_documents_document_code_id_tenant_id_idx";

ALTER TABLE "bid_document_classification_events" RENAME COLUMN "from_document_code_option_id" TO "from_document_code_id";
ALTER TABLE "bid_document_classification_events" RENAME COLUMN "to_document_code_option_id" TO "to_document_code_id";
ALTER TABLE "bid_document_classification_events" RENAME CONSTRAINT "bid_document_classification_events_from_document_code_option_id_tenant_id_fkey" TO "bid_document_classification_events_from_document_code_id_tenant_id_fkey";
ALTER TABLE "bid_document_classification_events" RENAME CONSTRAINT "bid_document_classification_events_to_document_code_option_id_tenant_id_fkey" TO "bid_document_classification_events_to_document_code_id_tenant_id_fkey";

ALTER TABLE "direct_project_documents" RENAME COLUMN "document_code_option_id" TO "document_code_id";
ALTER TABLE "direct_project_documents" RENAME CONSTRAINT "direct_project_documents_document_code_option_id_tenant_id_fkey" TO "direct_project_documents_document_code_id_tenant_id_fkey";
ALTER INDEX "direct_project_documents_document_code_option_id_tenant_id_idx" RENAME TO "direct_project_documents_document_code_id_tenant_id_idx";

ALTER TABLE "direct_project_document_classification_events" RENAME COLUMN "from_document_code_option_id" TO "from_document_code_id";
ALTER TABLE "direct_project_document_classification_events" RENAME COLUMN "to_document_code_option_id" TO "to_document_code_id";
ALTER TABLE "direct_project_document_classification_events" RENAME CONSTRAINT "direct_project_document_classification_events_from_code_id_tenant_id_fkey" TO "direct_project_document_classification_events_from_document_code_id_tenant_id_fkey";
ALTER TABLE "direct_project_document_classification_events" RENAME CONSTRAINT "direct_project_document_classification_events_to_code_id_tenant_id_fkey" TO "direct_project_document_classification_events_to_document_code_id_tenant_id_fkey";

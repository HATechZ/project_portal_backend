-- Additive and nullable: existing Work Request documents predate per-document
-- metadata capture, so no description or shipment number is fabricated.
--
-- Rollback: ALTER TABLE "work_request_v1_documents"
--             DROP COLUMN "description", DROP COLUMN "shipment_number";

ALTER TABLE "work_request_v1_documents"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "shipment_number" VARCHAR(10);

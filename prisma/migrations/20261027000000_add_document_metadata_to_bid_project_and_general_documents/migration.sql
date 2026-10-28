-- Additive and nullable: existing documents predate per-document metadata,
-- so no description or shipment number is fabricated.
--
-- Rollback:
--   ALTER TABLE "bid_documents"
--     DROP COLUMN "description", DROP COLUMN "shipment_number";
--   ALTER TABLE "direct_project_documents"
--     DROP COLUMN "description", DROP COLUMN "shipment_number";
--   ALTER TABLE "documents"
--     DROP COLUMN "shipment_number";

ALTER TABLE "bid_documents"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "shipment_number" VARCHAR(10);

ALTER TABLE "direct_project_documents"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "shipment_number" VARCHAR(10);

ALTER TABLE "documents"
  ADD COLUMN "shipment_number" VARCHAR(10);

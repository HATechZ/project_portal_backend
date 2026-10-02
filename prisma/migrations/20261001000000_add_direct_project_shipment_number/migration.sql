-- Additive and nullable: existing direct-project rows predate shipment-number
-- capture, so no business value is fabricated or overwritten.
--
-- Rollback: ALTER TABLE "direct_projects" DROP COLUMN "shipment_number";

ALTER TABLE "direct_projects"
  ADD COLUMN "shipment_number" VARCHAR(10);

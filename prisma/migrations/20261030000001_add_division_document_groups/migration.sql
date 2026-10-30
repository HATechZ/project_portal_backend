-- Persist explicit Division-to-document-group applicability without deriving
-- business behavior from Division display names. GENERAL remains implicit for
-- every eligible internal upload and is deliberately excluded from this map.
--
-- Rollback: DROP TABLE public.division_document_groups; removes its primary
-- key, index, tenant policy, and grants together. It does not alter document
-- code rows or document history.

CREATE TABLE "division_document_groups" (
    "tenant_id" UUID NOT NULL,
    "division_id" UUID NOT NULL,
    "document_group" "document_group_code" NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "division_document_groups_pkey"
      PRIMARY KEY ("tenant_id", "division_id", "document_group"),
    CONSTRAINT "division_document_groups_document_group_not_general"
      CHECK ("document_group" <> 'GENERAL'::"document_group_code")
);

CREATE INDEX "division_document_groups_tenant_id_document_group_idx"
  ON "division_document_groups"("tenant_id", "document_group");

ALTER TABLE "division_document_groups"
  ADD CONSTRAINT "division_document_groups_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "division_document_groups"
  ADD CONSTRAINT "division_document_groups_division_id_tenant_id_fkey"
  FOREIGN KEY ("division_id", "tenant_id") REFERENCES "divisions"("id", "tenant_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "division_document_groups" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_division_document_groups
  ON "division_document_groups"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

-- Rows are immutable applicability facts: configuration changes are explicit
-- insert/remove operations. UPDATE is intentionally not granted.
GRANT SELECT, INSERT, DELETE ON TABLE "division_document_groups" TO app_user;

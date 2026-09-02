-- DropForeignKey
ALTER TABLE "members" DROP CONSTRAINT "members_division_id_tenant_id_company_id_fkey";

-- DropForeignKey
ALTER TABLE "teams" DROP CONSTRAINT "teams_division_id_tenant_id_company_id_fkey";

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_division_id_tenant_id_company_id_fkey" FOREIGN KEY ("division_id", "tenant_id", "company_id") REFERENCES "divisions"("id", "tenant_id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_division_id_tenant_id_company_id_fkey" FOREIGN KEY ("division_id", "tenant_id", "company_id") REFERENCES "divisions"("id", "tenant_id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

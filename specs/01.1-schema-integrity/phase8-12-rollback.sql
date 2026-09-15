-- Symmetrical rollback for 20260902010000_harden_retained_architecture.
DROP INDEX IF EXISTS "actor_profiles_one_default_per_user";
ALTER TABLE "actor_profiles"
  DROP CONSTRAINT IF EXISTS "actor_profiles_at_most_one_business_target";

DROP INDEX IF EXISTS "workflow_transitions_active_exact_rule_key";

DROP INDEX IF EXISTS "teams_division_id_tenant_id_company_id_idx";
DROP INDEX IF EXISTS "members_division_id_tenant_id_company_id_idx";

ALTER TABLE "teams"
  DROP CONSTRAINT IF EXISTS "teams_division_id_tenant_id_company_id_fkey";
ALTER TABLE "teams"
  ADD CONSTRAINT "teams_division_id_fkey"
  FOREIGN KEY ("division_id") REFERENCES "divisions" ("id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "members"
  DROP CONSTRAINT IF EXISTS "members_division_id_tenant_id_company_id_fkey";
ALTER TABLE "members"
  ADD CONSTRAINT "members_division_id_fkey"
  FOREIGN KEY ("division_id") REFERENCES "divisions" ("id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "divisions"
  DROP CONSTRAINT IF EXISTS "divisions_id_tenant_id_company_id_key";

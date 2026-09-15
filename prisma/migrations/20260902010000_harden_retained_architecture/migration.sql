-- Phase 8: retain company_id while making division/company/tenant agreement structural.
ALTER TABLE "divisions"
  ADD CONSTRAINT "divisions_id_tenant_id_company_id_key"
  UNIQUE ("id", "tenant_id", "company_id");

ALTER TABLE "members" DROP CONSTRAINT "members_division_id_fkey";
ALTER TABLE "members"
  ADD CONSTRAINT "members_division_id_tenant_id_company_id_fkey"
  FOREIGN KEY ("division_id", "tenant_id", "company_id")
  REFERENCES "divisions" ("id", "tenant_id", "company_id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "teams" DROP CONSTRAINT "teams_division_id_fkey";
ALTER TABLE "teams"
  ADD CONSTRAINT "teams_division_id_tenant_id_company_id_fkey"
  FOREIGN KEY ("division_id", "tenant_id", "company_id")
  REFERENCES "divisions" ("id", "tenant_id", "company_id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE INDEX "members_division_id_tenant_id_company_id_idx"
  ON "members" ("division_id", "tenant_id", "company_id");
CREATE INDEX "teams_division_id_tenant_id_company_id_idx"
  ON "teams" ("division_id", "tenant_id", "company_id");

-- Phase 9: exact active configuration duplicates are forbidden. NULLS NOT
-- DISTINCT makes nullable role/status fields compare as equal. Inactive rows
-- are deliberately outside the key, so history may contain duplicates.
CREATE UNIQUE INDEX "workflow_transitions_active_exact_rule_key"
  ON "workflow_transitions" (
    "tenant_id", "action_id", "from_status_id", "to_status_id",
    "from_role_id", "target_role_id", "requires_assignment",
    "is_backward_transition", "sort_order"
  ) NULLS NOT DISTINCT
  WHERE "is_active" = true;

-- Phase 11: role-only profiles remain valid; only the ambiguous two-target
-- state is forbidden.
ALTER TABLE "actor_profiles"
  ADD CONSTRAINT "actor_profiles_at_most_one_business_target"
  CHECK (NOT ("member_id" IS NOT NULL AND "client_contact_id" IS NOT NULL));

CREATE UNIQUE INDEX "actor_profiles_one_default_per_user"
  ON "actor_profiles" ("tenant_id", "user_id")
  WHERE "user_id" IS NOT NULL AND "is_default" = true;

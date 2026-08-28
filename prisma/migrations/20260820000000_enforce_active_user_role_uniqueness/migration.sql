-- Preserve the temporal assignment history while guaranteeing only one active
-- assignment for a tenant/user/role tuple. Revoke duplicate legacy rows first.
WITH ranked_active_roles AS (
  SELECT "id",
         ROW_NUMBER() OVER (
           PARTITION BY "tenant_id", "user_id", "role_id"
           ORDER BY "assigned_at" DESC, "id" DESC
         ) AS row_number
  FROM "user_roles"
  WHERE "revoked_at" IS NULL
)
UPDATE "user_roles" AS user_role
SET "revoked_at" = CURRENT_TIMESTAMP
FROM ranked_active_roles
WHERE user_role."id" = ranked_active_roles."id"
  AND ranked_active_roles.row_number > 1;

CREATE UNIQUE INDEX "user_roles_active_tenant_user_role_key"
ON "user_roles" ("tenant_id", "user_id", "role_id")
WHERE "revoked_at" IS NULL;

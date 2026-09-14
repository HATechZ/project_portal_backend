-- Add the approved Client administration capabilities, grant them only to
-- system_admin, and establish the ClientContact active-primary invariant.
-- Existing role/action mappings are retained unchanged.
--
-- Rollback note: first delete these three action definitions' permission rows, drop
-- client_contacts_one_active_primary_per_client_key, then rebuild
-- workflow_action_code without these labels as described in the preceding migration.

INSERT INTO "workflow_action_definitions" (
  "id",
  "code",
  "name",
  "description",
  "is_user_visible",
  "is_revision_action",
  "is_info_request_action",
  "is_assignment_action",
  "is_terminal_action"
)
VALUES
  (
    gen_random_uuid(),
    'MANAGE_CLIENT',
    'Manage Client',
    'Allows the manage client action.',
    true,
    false,
    false,
    false,
    false
  ),
  (
    gen_random_uuid(),
    'MANAGE_CLIENT_CONTACT',
    'Manage Client Contact',
    'Allows the manage client contact action.',
    true,
    false,
    false,
    false,
    false
  ),
  (
    gen_random_uuid(),
    'MANAGE_CLIENT_PORTAL_ACCESS',
    'Manage Client Portal Access',
    'Allows the manage client portal access action.',
    true,
    false,
    false,
    false,
    false
  )
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "workflow_action_role_permissions" (
  "tenant_id",
  "id",
  "action_id",
  "role_id",
  "allowed"
)
SELECT
  tenant."id",
  gen_random_uuid(),
  action_definition."id",
  role_definition."id",
  role_definition."code" = 'system_admin'::"actor_role_code"
FROM "tenants" AS tenant
CROSS JOIN "roles" AS role_definition
CROSS JOIN "workflow_action_definitions" AS action_definition
WHERE role_definition."is_system_role" = true
  AND action_definition."code" IN (
    'MANAGE_CLIENT'::"workflow_action_code",
    'MANAGE_CLIENT_CONTACT'::"workflow_action_code",
    'MANAGE_CLIENT_PORTAL_ACCESS'::"workflow_action_code"
  )
ON CONFLICT ("tenant_id", "action_id", "role_id") DO NOTHING;

CREATE UNIQUE INDEX "client_contacts_one_active_primary_per_client_key"
  ON "client_contacts" ("client_id")
  WHERE "is_active" = true AND "is_primary" = true;

-- Clients and ClientContacts were already RLS-protected for app_user. Grant the
-- minimal lifecycle-write surface; Identity tables already have the required
-- app_user grants (users, user_roles, actor_profiles, password_reset_tokens).
GRANT SELECT, INSERT, UPDATE ON TABLE
  "clients",
  "client_contacts"
TO app_user;

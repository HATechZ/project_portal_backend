-- Backfill explicit grants for tenants that existed before the final permission
-- catalogue. New company workspaces receive these grants in
-- provision_company_workspace_core; this migration covers only tenants already
-- represented by an active tenant_super_admin actor profile or user-role grant.
--
-- Rollback: UPDATE public.role_permissions SET revoked_at = now() for rows
-- created by this migration after identifying them from the deployment audit.
-- Do not delete role grants: revocation preserves access history.

WITH tenant_super_admin_role AS (
  SELECT system_role.role_id
  FROM public.system_roles AS system_role
  JOIN public.roles AS role_definition ON role_definition.id = system_role.role_id
  WHERE system_role.system_code = 'tenant_super_admin'::public.actor_role_code
    AND role_definition.is_active = true
), represented_tenants AS (
  SELECT actor_profile.tenant_id
  FROM public.actor_profiles AS actor_profile
  CROSS JOIN tenant_super_admin_role
  WHERE actor_profile.role_id = tenant_super_admin_role.role_id
    AND actor_profile.is_active = true

  UNION

  SELECT user_role.tenant_id
  FROM public.user_roles AS user_role
  CROSS JOIN tenant_super_admin_role
  WHERE user_role.role_id = tenant_super_admin_role.role_id
    AND user_role.revoked_at IS NULL
)
INSERT INTO public.role_permissions (tenant_id, role_id, permission_id)
SELECT represented_tenants.tenant_id, tenant_super_admin_role.role_id, permission.id
FROM represented_tenants
CROSS JOIN tenant_super_admin_role
CROSS JOIN public.permissions AS permission
WHERE permission.code <> 'DECIDE_BID_OUTCOME'::public.permission_code
ON CONFLICT DO NOTHING;

-- Align the tenant_super_admin permission bundle with tenant-wide INTERNAL
-- administration. Client delivery decisions remain external-only.
--
-- Rollback: revoke active DECIDE_BID_OUTCOME grants introduced by this
-- migration and re-grant only deliberately reviewed client-decision grants.
-- Do not delete role_permissions: revocation preserves grant history. Restore
-- the preceding role-permission trigger and workspace-provisioning function
-- only as part of that deliberate rollback.

CREATE OR REPLACE FUNCTION public.assert_role_permission_tenant_match()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.roles AS role_definition
    WHERE role_definition.id = NEW.role_id
      AND role_definition.is_active = true
      AND (
        (
          role_definition.is_system_role = true
          AND EXISTS (
            SELECT 1
            FROM public.system_roles AS system_role
            WHERE system_role.role_id = role_definition.id
              AND system_role.system_code = 'tenant_super_admin'::public.actor_role_code
          )
          AND NOT EXISTS (
            SELECT 1
            FROM public.permissions AS permission
            WHERE permission.id = NEW.permission_id
              AND permission.code IN (
                'ACCEPT_FINAL_DELIVERY'::public.permission_code,
                'REJECT_FINAL_DELIVERY'::public.permission_code,
                'REQUEST_REVISION'::public.permission_code
              )
          )
        )
        OR (
          role_definition.is_system_role = false
          AND role_definition.tenant_id = NEW.tenant_id
          AND EXISTS (
            SELECT 1
            FROM public.permission_scope_compatibilities AS compatibility
            WHERE compatibility.permission_id = NEW.permission_id
              AND compatibility.scope = role_definition.custom_scope
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'Role permission must target a compatible active custom role or tenant_super_admin without client-only delivery decisions'
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$function$;

-- Existing tenant administrators receive every catalogue permission except the
-- three permissions used exclusively for external ClientContact final decisions.
-- Internal Work Request revision uses REQUEST_WORK_REQUEST_REVISION, so it is
-- preserved in the tenant-super-admin bundle.
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
WHERE permission.code NOT IN (
  'ACCEPT_FINAL_DELIVERY'::public.permission_code,
  'REJECT_FINAL_DELIVERY'::public.permission_code,
  'REQUEST_REVISION'::public.permission_code
)
ON CONFLICT DO NOTHING;

-- Supersede the historical over-grants without deleting audit history.
UPDATE public.role_permissions AS role_permission
SET revoked_at = now()
FROM public.system_roles AS system_role,
     public.permissions AS permission
WHERE role_permission.role_id = system_role.role_id
  AND role_permission.permission_id = permission.id
  AND system_role.system_code = 'tenant_super_admin'::public.actor_role_code
  AND role_permission.revoked_at IS NULL
  AND permission.code IN (
    'ACCEPT_FINAL_DELIVERY'::public.permission_code,
    'REJECT_FINAL_DELIVERY'::public.permission_code,
    'REQUEST_REVISION'::public.permission_code
  );

-- New tenant workspaces use the same internal-only bundle. Keep this targeted
-- rewrite fail-closed: a changed provisioning definition must be reviewed
-- rather than silently receiving an incomplete or over-broad grant set.
DO $migration$
DECLARE
  v_provision_definition text;
  v_marker text := E'  WHERE permission.code <> ''DECIDE_BID_OUTCOME''::public.permission_code;';
  v_replacement text := E'  WHERE permission.code NOT IN (\n    ''ACCEPT_FINAL_DELIVERY''::public.permission_code,\n    ''REJECT_FINAL_DELIVERY''::public.permission_code,\n    ''REQUEST_REVISION''::public.permission_code\n  );';
BEGIN
  SELECT pg_get_functiondef(
    'public.provision_company_workspace_core(text,text,uuid,text,text,text,text,text)'::regprocedure
  ) INTO v_provision_definition;

  IF position(v_marker IN v_provision_definition) = 0 THEN
    RAISE EXCEPTION 'Cannot align workspace provisioning: expected tenant_super_admin grant statement was not found'
      USING ERRCODE = '55000';
  END IF;

  v_provision_definition := replace(v_provision_definition, v_marker, v_replacement);
  EXECUTE v_provision_definition;
END;
$migration$;

REVOKE ALL ON FUNCTION public.provision_company_workspace_core(text, text, uuid, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.provision_company_workspace_core(text, text, uuid, text, text, text, text, text) FROM app_user;

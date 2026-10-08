-- Reconcile the protected tenant-owned starter roles and their explicit grants.
--
-- Rollback: revoke (do not delete) active grants created for the three starter
-- roles, then retire only roles proven to have been created by this migration.
-- Restore the immediately preceding provision_company_workspace_core definition
-- only after the role/grant rollback has completed. Existing custom roles and
-- grants must never be reset or deleted.

CREATE OR REPLACE FUNCTION public.reconcile_tenant_starter_roles(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_starter record;
  v_role record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id) THEN
    RAISE EXCEPTION 'Cannot reconcile starter roles: tenant % does not exist', p_tenant_id
      USING ERRCODE = '23503';
  END IF;

  -- Fail before writing if the final catalogue or its frozen scope compatibility
  -- no longer supports the approved starter bundles.
  IF EXISTS (
    SELECT 1
    FROM (
      VALUES
        ('staff'::text, 'member'::public.custom_role_scope, 'VIEW_MEMBERS'::public.permission_code),
        ('staff', 'member', 'VIEW_DESIGNATIONS'),
        ('staff', 'member', 'VIEW_CLIENTS'),
        ('staff', 'member', 'VIEW_BID'),
        ('staff', 'member', 'VIEW_PROJECT'),
        ('staff', 'member', 'VIEW_WORK_REQUEST'),
        ('staff', 'member', 'VIEW_DOCUMENT'),
        ('staff', 'member', 'VIEW_DOCUMENT_CODES'),
        ('supervisor', 'team', 'VIEW_MEMBERS'),
        ('supervisor', 'team', 'VIEW_DESIGNATIONS'),
        ('supervisor', 'team', 'VIEW_CLIENTS'),
        ('supervisor', 'team', 'VIEW_BID'),
        ('supervisor', 'team', 'VIEW_PROJECT'),
        ('supervisor', 'team', 'VIEW_WORK_REQUEST'),
        ('supervisor', 'team', 'VIEW_DOCUMENT'),
        ('supervisor', 'team', 'VIEW_DOCUMENT_CODES'),
        ('supervisor', 'team', 'VIEW_TEAMS'),
        ('supervisor', 'team', 'ASSIGN_WORK_REQUEST_MEMBER'),
        ('supervisor', 'team', 'APPROVE_WORK_REQUEST_REVIEW'),
        ('supervisor', 'team', 'REQUEST_WORK_REQUEST_REVISION'),
        ('supervisor', 'team', 'REQUEST_INFO'),
        ('supervisor', 'team', 'RESPOND_TO_INFO_REQUEST'),
        ('manager', 'division', 'VIEW_MEMBERS'),
        ('manager', 'division', 'VIEW_DESIGNATIONS'),
        ('manager', 'division', 'VIEW_CLIENTS'),
        ('manager', 'division', 'VIEW_BID'),
        ('manager', 'division', 'VIEW_PROJECT'),
        ('manager', 'division', 'VIEW_WORK_REQUEST'),
        ('manager', 'division', 'VIEW_DOCUMENT'),
        ('manager', 'division', 'VIEW_DOCUMENT_CODES'),
        ('manager', 'division', 'VIEW_TEAMS'),
        ('manager', 'division', 'ASSIGN_WORK_REQUEST_MEMBER'),
        ('manager', 'division', 'APPROVE_WORK_REQUEST_REVIEW'),
        ('manager', 'division', 'REQUEST_WORK_REQUEST_REVISION'),
        ('manager', 'division', 'REQUEST_INFO'),
        ('manager', 'division', 'RESPOND_TO_INFO_REQUEST'),
        ('manager', 'division', 'VIEW_DIVISIONS'),
        ('manager', 'division', 'ASSIGN_WORK_REQUEST_TEAM')
    ) AS expected(custom_code, custom_scope, permission_code)
    LEFT JOIN public.permissions AS permission
      ON permission.code = expected.permission_code
    LEFT JOIN public.permission_scope_compatibilities AS compatibility
      ON compatibility.permission_id = permission.id
      AND compatibility.scope = expected.custom_scope
    WHERE permission.id IS NULL OR compatibility.permission_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot reconcile starter roles: the approved starter grant catalogue or scope compatibility is incomplete'
      USING ERRCODE = '55000';
  END IF;

  FOR v_starter IN
    SELECT *
    FROM (
      VALUES
        ('staff'::text, 'Staff'::text, 'member'::public.custom_role_scope),
        ('supervisor', 'Supervisor', 'team'),
        ('manager', 'Manager', 'division')
    ) AS starter(custom_code, display_name, custom_scope)
  LOOP
    SELECT role_definition.id,
           role_definition.is_system_role,
           role_definition.custom_scope,
           role_definition.is_active,
           role_definition.retired_at,
           EXISTS (
             SELECT 1
             FROM public.system_roles AS system_role
             WHERE system_role.role_id = role_definition.id
           ) AS has_system_identity
    INTO v_role
    FROM public.roles AS role_definition
    WHERE role_definition.tenant_id = p_tenant_id
      AND role_definition.custom_code = v_starter.custom_code;

    IF FOUND THEN
      IF v_role.is_system_role
         OR v_role.has_system_identity
         OR v_role.custom_scope IS DISTINCT FROM v_starter.custom_scope
         OR v_role.is_active = false
         OR v_role.retired_at IS NOT NULL THEN
        RAISE EXCEPTION 'Starter role conflict for tenant %, customCode %: expected an active normal role with scope %',
          p_tenant_id, v_starter.custom_code, v_starter.custom_scope
          USING ERRCODE = '23514';
      END IF;
    ELSE
      INSERT INTO public.roles (
        id, tenant_id, name, description, is_system_role,
        custom_code, custom_scope, is_active, retired_at
      ) VALUES (
        gen_random_uuid(), p_tenant_id, v_starter.display_name, NULL, false,
        v_starter.custom_code, v_starter.custom_scope, true, NULL
      );
    END IF;
  END LOOP;

  -- Add only absent active grants. Revoked rows remain historical records and
  -- unrelated compatible grants remain untouched.
  INSERT INTO public.role_permissions (tenant_id, role_id, permission_id)
  SELECT p_tenant_id, role_definition.id, permission.id
  FROM (
    VALUES
      ('staff'::text, 'VIEW_MEMBERS'::public.permission_code),
      ('staff', 'VIEW_DESIGNATIONS'),
      ('staff', 'VIEW_CLIENTS'),
      ('staff', 'VIEW_BID'),
      ('staff', 'VIEW_PROJECT'),
      ('staff', 'VIEW_WORK_REQUEST'),
      ('staff', 'VIEW_DOCUMENT'),
      ('staff', 'VIEW_DOCUMENT_CODES'),
      ('supervisor', 'VIEW_MEMBERS'),
      ('supervisor', 'VIEW_DESIGNATIONS'),
      ('supervisor', 'VIEW_CLIENTS'),
      ('supervisor', 'VIEW_BID'),
      ('supervisor', 'VIEW_PROJECT'),
      ('supervisor', 'VIEW_WORK_REQUEST'),
      ('supervisor', 'VIEW_DOCUMENT'),
      ('supervisor', 'VIEW_DOCUMENT_CODES'),
      ('supervisor', 'VIEW_TEAMS'),
      ('supervisor', 'ASSIGN_WORK_REQUEST_MEMBER'),
      ('supervisor', 'APPROVE_WORK_REQUEST_REVIEW'),
      ('supervisor', 'REQUEST_WORK_REQUEST_REVISION'),
      ('supervisor', 'REQUEST_INFO'),
      ('supervisor', 'RESPOND_TO_INFO_REQUEST'),
      ('manager', 'VIEW_MEMBERS'),
      ('manager', 'VIEW_DESIGNATIONS'),
      ('manager', 'VIEW_CLIENTS'),
      ('manager', 'VIEW_BID'),
      ('manager', 'VIEW_PROJECT'),
      ('manager', 'VIEW_WORK_REQUEST'),
      ('manager', 'VIEW_DOCUMENT'),
      ('manager', 'VIEW_DOCUMENT_CODES'),
      ('manager', 'VIEW_TEAMS'),
      ('manager', 'ASSIGN_WORK_REQUEST_MEMBER'),
      ('manager', 'APPROVE_WORK_REQUEST_REVIEW'),
      ('manager', 'REQUEST_WORK_REQUEST_REVISION'),
      ('manager', 'REQUEST_INFO'),
      ('manager', 'RESPOND_TO_INFO_REQUEST'),
      ('manager', 'VIEW_DIVISIONS'),
      ('manager', 'ASSIGN_WORK_REQUEST_TEAM')
  ) AS expected(custom_code, permission_code)
  JOIN public.roles AS role_definition
    ON role_definition.tenant_id = p_tenant_id
    AND role_definition.custom_code = expected.custom_code
  JOIN public.permissions AS permission
    ON permission.code = expected.permission_code
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.role_permissions AS existing_grant
    WHERE existing_grant.tenant_id = p_tenant_id
      AND existing_grant.role_id = role_definition.id
      AND existing_grant.permission_id = permission.id
      AND existing_grant.revoked_at IS NULL
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.reconcile_tenant_starter_roles(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reconcile_tenant_starter_roles(uuid) FROM app_user;

-- Reconcile every existing tenant before the canonical new-workspace function
-- begins invoking the same idempotent operation.
DO $migration$
DECLARE
  v_tenant record;
  v_provision_definition text;
  v_marker text := E'  WHERE permission.code <> ''DECIDE_BID_OUTCOME''::public.permission_code;\n  RETURN QUERY SELECT v_tenant_id, v_company_id, v_user_id, v_user_role_id, v_actor_profile_id;';
  v_replacement text := E'  WHERE permission.code <> ''DECIDE_BID_OUTCOME''::public.permission_code;\n  PERFORM public.reconcile_tenant_starter_roles(v_tenant_id);\n  RETURN QUERY SELECT v_tenant_id, v_company_id, v_user_id, v_user_role_id, v_actor_profile_id;';
BEGIN
  FOR v_tenant IN SELECT id FROM public.tenants LOOP
    PERFORM public.reconcile_tenant_starter_roles(v_tenant.id);
  END LOOP;

  SELECT pg_get_functiondef(
    'public.provision_company_workspace_core(text,text,uuid,text,text,text,text,text)'::regprocedure
  ) INTO v_provision_definition;

  IF position(v_marker IN v_provision_definition) = 0 THEN
    RAISE EXCEPTION 'Cannot extend workspace provisioning: expected final tenant_super_admin grant statement was not found'
      USING ERRCODE = '55000';
  END IF;

  v_provision_definition := replace(v_provision_definition, v_marker, v_replacement);
  EXECUTE v_provision_definition;
END;
$migration$;

REVOKE ALL ON FUNCTION public.provision_company_workspace_core(text, text, uuid, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.provision_company_workspace_core(text, text, uuid, text, text, text, text, text) FROM app_user;

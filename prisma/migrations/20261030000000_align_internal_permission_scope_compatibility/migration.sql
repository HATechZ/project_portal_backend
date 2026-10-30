-- Align internal PermissionScopeCompatibility rows to the implemented
-- company/division/team/member responsibility model.
--
-- This migration does not alter permission codes, roles, actor profiles, or
-- external client/client_contact compatibility. Before changing catalogue
-- rows, it revokes active grants on internal custom roles that would no
-- longer be compatible. Revocation (rather than deletion) preserves the
-- role-permission audit trail and prevents stale grants from becoming active
-- again through an unrelated role update.
--
-- Rollback: restore the prior internal compatibility matrix deliberately and
-- set revoked_at back to NULL only for grants reviewed as safe under that
-- restored matrix. Do not delete RolePermission history.

WITH desired(code, scope) AS (
  VALUES
    ('VIEW_ROLES'::public.permission_code, 'company'::public.custom_role_scope),
    ('CREATE_ROLE', 'company'),
    ('UPDATE_ROLE', 'company'),
    ('RETIRE_ROLE', 'company'),
    ('ASSIGN_ROLES', 'company'),
    ('REVOKE_ROLES', 'company'),
    ('CREATE_USER', 'company'),
    ('VIEW_USERS', 'company'),
    ('UPDATE_USER', 'company'),
    ('DELETE_USER', 'company'),
    ('REVOKE_USER_SESSIONS', 'company'),
    ('CREATE_COMPANY', 'company'),
    ('VIEW_COMPANY', 'company'),
    ('UPDATE_COMPANY', 'company'),
    ('CREATE_DIVISION', 'company'),
    ('VIEW_DIVISIONS', 'company'),
    ('VIEW_DIVISIONS', 'division'),
    ('UPDATE_DIVISION', 'company'),
    ('UPDATE_DIVISION', 'division'),
    ('DELETE_DIVISION', 'company'),
    ('DELETE_DIVISION', 'division'),
    ('ASSIGN_DIVISION_LEAD', 'company'),
    ('ASSIGN_DIVISION_LEAD', 'division'),
    ('REVOKE_DIVISION_LEAD', 'company'),
    ('REVOKE_DIVISION_LEAD', 'division'),
    ('CREATE_TEAM', 'company'),
    ('CREATE_TEAM', 'division'),
    ('VIEW_TEAMS', 'company'),
    ('VIEW_TEAMS', 'division'),
    ('VIEW_TEAMS', 'team'),
    ('UPDATE_TEAM', 'company'),
    ('UPDATE_TEAM', 'division'),
    ('UPDATE_TEAM', 'team'),
    ('DELETE_TEAM', 'company'),
    ('DELETE_TEAM', 'division'),
    ('DELETE_TEAM', 'team'),
    ('ASSIGN_TEAM_MEMBER', 'company'),
    ('ASSIGN_TEAM_MEMBER', 'division'),
    ('ASSIGN_TEAM_MEMBER', 'team'),
    ('REMOVE_TEAM_MEMBER', 'company'),
    ('REMOVE_TEAM_MEMBER', 'division'),
    ('REMOVE_TEAM_MEMBER', 'team'),
    ('CREATE_MEMBER', 'company'),
    ('CREATE_MEMBER', 'division'),
    ('VIEW_MEMBERS', 'company'),
    ('VIEW_MEMBERS', 'division'),
    ('VIEW_MEMBERS', 'team'),
    ('VIEW_MEMBERS', 'member'),
    ('UPDATE_MEMBER', 'company'),
    ('UPDATE_MEMBER', 'division'),
    ('UPDATE_MEMBER', 'team'),
    ('REMOVE_MEMBER', 'company'),
    ('REMOVE_MEMBER', 'division'),
    ('REMOVE_MEMBER', 'team'),
    ('LINK_MEMBER_ACCESS', 'company'),
    ('LINK_MEMBER_ACCESS', 'division'),
    ('LINK_MEMBER_ACCESS', 'team'),
    ('VIEW_DESIGNATIONS', 'company'),
    ('CREATE_DESIGNATION', 'company'),
    ('UPDATE_DESIGNATION', 'company'),
    ('DELETE_DESIGNATION', 'company'),
    ('CREATE_CLIENT', 'company'),
    ('VIEW_CLIENTS', 'company'),
    ('UPDATE_CLIENT', 'company'),
    ('DEACTIVATE_CLIENT', 'company'),
    ('REACTIVATE_CLIENT', 'company'),
    ('CREATE_CLIENT_CONTACT', 'company'),
    ('VIEW_CLIENT_CONTACTS', 'company'),
    ('UPDATE_CLIENT_CONTACT', 'company'),
    ('DEACTIVATE_CLIENT_CONTACT', 'company'),
    ('REACTIVATE_CLIENT_CONTACT', 'company'),
    ('SET_PRIMARY_CLIENT_CONTACT', 'company'),
    ('GRANT_CLIENT_PORTAL_ACCESS', 'company'),
    ('REVOKE_CLIENT_PORTAL_ACCESS', 'company'),
    ('CREATE_BID', 'company'),
    ('CREATE_BID', 'division'),
    ('VIEW_BID', 'company'),
    ('VIEW_BID', 'division'),
    ('VIEW_BID', 'team'),
    ('VIEW_BID', 'member'),
    ('UPDATE_BID', 'company'),
    ('UPDATE_BID', 'division'),
    ('ARCHIVE_BID', 'company'),
    ('ARCHIVE_BID', 'division'),
    ('RESTORE_BID', 'company'),
    ('RESTORE_BID', 'division'),
    ('DECIDE_BID_OUTCOME', 'company'),
    ('DECIDE_BID_OUTCOME', 'division'),
    ('REQUEST_ARCHIVED_BID_REVIEW', 'company'),
    ('REQUEST_ARCHIVED_BID_REVIEW', 'division'),
    ('CREATE_PROJECT', 'company'),
    ('CREATE_PROJECT', 'division'),
    ('VIEW_PROJECT', 'company'),
    ('VIEW_PROJECT', 'division'),
    ('VIEW_PROJECT', 'team'),
    ('VIEW_PROJECT', 'member'),
    ('UPDATE_PROJECT', 'company'),
    ('UPDATE_PROJECT', 'division'),
    ('ARCHIVE_PROJECT', 'company'),
    ('ARCHIVE_PROJECT', 'division'),
    ('RESTORE_PROJECT', 'company'),
    ('RESTORE_PROJECT', 'division'),
    ('CREATE_WORK_REQUEST', 'company'),
    ('CREATE_WORK_REQUEST', 'division'),
    ('VIEW_WORK_REQUEST', 'company'),
    ('VIEW_WORK_REQUEST', 'division'),
    ('VIEW_WORK_REQUEST', 'team'),
    ('VIEW_WORK_REQUEST', 'member'),
    ('UPDATE_WORK_REQUEST', 'company'),
    ('UPDATE_WORK_REQUEST', 'division'),
    ('CREATE_WORK_REQUEST_NOTE', 'company'),
    ('CREATE_WORK_REQUEST_NOTE', 'division'),
    ('CREATE_WORK_REQUEST_NOTE', 'team'),
    ('CREATE_WORK_REQUEST_NOTE', 'member'),
    ('ASSIGN_WORK_REQUEST_DIVISION', 'company'),
    ('ASSIGN_WORK_REQUEST_DIVISION', 'division'),
    ('ASSIGN_WORK_REQUEST_TEAM', 'division'),
    ('ASSIGN_WORK_REQUEST_MEMBER', 'team'),
    -- Normal submission is member-bound; Division/Team are limited to exact
    -- source-based revision resubmission by the persisted problem source.
    ('SUBMIT_WORK_REQUEST', 'division'),
    ('SUBMIT_WORK_REQUEST', 'team'),
    ('SUBMIT_WORK_REQUEST', 'member'),
    ('APPROVE_WORK_REQUEST_REVIEW', 'team'),
    ('REQUEST_WORK_REQUEST_REVISION', 'division'),
    ('REQUEST_WORK_REQUEST_REVISION', 'team'),
    ('REQUEST_WORK_REQUEST_REVISION', 'member'),
    ('VIEW_DOCUMENT', 'company'),
    ('VIEW_DOCUMENT', 'division'),
    ('VIEW_DOCUMENT', 'team'),
    ('VIEW_DOCUMENT', 'member'),
    ('UPLOAD_DOCUMENT', 'company'),
    ('UPLOAD_DOCUMENT', 'division'),
    ('UPLOAD_DOCUMENT', 'team'),
    ('UPLOAD_DOCUMENT', 'member'),
    ('SUBMIT_DOCUMENT', 'member'),
    ('VIEW_DOCUMENT_CODES', 'company'),
    ('CREATE_DOCUMENT_CODE', 'company'),
    ('UPDATE_DOCUMENT_CODE', 'company'),
    ('DELETE_DOCUMENT_CODE', 'company'),
    ('DEACTIVATE_DOCUMENT_CODE', 'company'),
    ('REACTIVATE_DOCUMENT_CODE', 'company'),
    ('ROUTE_FOR_REVIEW', 'division'),
    ('ASSIGN_REVIEWER', 'team'),
    ('APPROVE_REVIEW', 'team'),
    ('REJECT_REVIEW', 'team'),
    ('APPROVE_ORIGIN_REVIEW', 'company'),
    ('APPROVE_ORIGIN_REVIEW', 'division'),
    ('REJECT_ORIGIN_REVIEW', 'company'),
    ('REJECT_ORIGIN_REVIEW', 'division'),
    ('REQUEST_INFO', 'company'),
    ('REQUEST_INFO', 'division'),
    ('REQUEST_INFO', 'team'),
    ('REQUEST_INFO', 'member'),
    ('RESPOND_TO_INFO_REQUEST', 'company'),
    ('RESPOND_TO_INFO_REQUEST', 'division'),
    ('RESPOND_TO_INFO_REQUEST', 'team'),
    ('RESPOND_TO_INFO_REQUEST', 'member'),
    ('REQUEST_REVISION', 'division'),
    ('REQUEST_REVISION', 'team'),
    ('REQUEST_REVISION', 'member'),
    ('SUBMIT_FOR_REVIEW', 'member'),
    ('ESCALATE_TO_EXTERNAL_REVIEW', 'company'),
    ('ESCALATE_TO_EXTERNAL_REVIEW', 'division'),
    ('SUBMIT_FOR_EXTERNAL_REVIEW', 'company'),
    ('SUBMIT_FOR_EXTERNAL_REVIEW', 'division'),
    ('SUBMIT_CLIENT_REVISION', 'company'),
    ('SUBMIT_CLIENT_REVISION', 'division'),
    ('VIEW_SETTINGS', 'company'),
    ('UPDATE_SETTINGS', 'company'),
    ('VIEW_REFERENCE_DATA', 'company'),
    ('CREATE_REFERENCE_DATA_OPTION', 'company'),
    ('UPDATE_REFERENCE_DATA_OPTION', 'company'),
    ('DEACTIVATE_REFERENCE_DATA_OPTION', 'company'),
    ('REACTIVATE_REFERENCE_DATA_OPTION', 'company')
)
UPDATE public.role_permissions AS role_permission
SET revoked_at = now()
FROM public.roles AS role_definition,
     public.permissions AS permission
WHERE role_permission.role_id = role_definition.id
  AND permission.id = role_permission.permission_id
  AND role_permission.revoked_at IS NULL
  AND role_definition.is_system_role = false
  AND role_definition.custom_scope IN (
    'company'::public.custom_role_scope,
    'division'::public.custom_role_scope,
    'team'::public.custom_role_scope,
    'member'::public.custom_role_scope
  )
  AND NOT EXISTS (
    SELECT 1
    FROM desired
    WHERE desired.code = permission.code
      AND desired.scope = role_definition.custom_scope
  );

-- The external scope rows deliberately remain intact. They are governed by
-- their Client/ClientContact relationship checks, not this internal matrix.
DELETE FROM public.permission_scope_compatibilities
WHERE scope IN (
  'company'::public.custom_role_scope,
  'division'::public.custom_role_scope,
  'team'::public.custom_role_scope,
  'member'::public.custom_role_scope
);

INSERT INTO public.permission_scope_compatibilities (permission_id, scope)
SELECT permission.id, desired.scope
FROM public.permissions AS permission
JOIN (
  VALUES
    ('VIEW_ROLES'::public.permission_code, 'company'::public.custom_role_scope),
    ('CREATE_ROLE', 'company'), ('UPDATE_ROLE', 'company'), ('RETIRE_ROLE', 'company'), ('ASSIGN_ROLES', 'company'), ('REVOKE_ROLES', 'company'),
    ('CREATE_USER', 'company'), ('VIEW_USERS', 'company'), ('UPDATE_USER', 'company'), ('DELETE_USER', 'company'), ('REVOKE_USER_SESSIONS', 'company'),
    ('CREATE_COMPANY', 'company'), ('VIEW_COMPANY', 'company'), ('UPDATE_COMPANY', 'company'),
    ('CREATE_DIVISION', 'company'), ('VIEW_DIVISIONS', 'company'), ('VIEW_DIVISIONS', 'division'), ('UPDATE_DIVISION', 'company'), ('UPDATE_DIVISION', 'division'), ('DELETE_DIVISION', 'company'), ('DELETE_DIVISION', 'division'), ('ASSIGN_DIVISION_LEAD', 'company'), ('ASSIGN_DIVISION_LEAD', 'division'), ('REVOKE_DIVISION_LEAD', 'company'), ('REVOKE_DIVISION_LEAD', 'division'),
    ('CREATE_TEAM', 'company'), ('CREATE_TEAM', 'division'), ('VIEW_TEAMS', 'company'), ('VIEW_TEAMS', 'division'), ('VIEW_TEAMS', 'team'), ('UPDATE_TEAM', 'company'), ('UPDATE_TEAM', 'division'), ('UPDATE_TEAM', 'team'), ('DELETE_TEAM', 'company'), ('DELETE_TEAM', 'division'), ('DELETE_TEAM', 'team'), ('ASSIGN_TEAM_MEMBER', 'company'), ('ASSIGN_TEAM_MEMBER', 'division'), ('ASSIGN_TEAM_MEMBER', 'team'), ('REMOVE_TEAM_MEMBER', 'company'), ('REMOVE_TEAM_MEMBER', 'division'), ('REMOVE_TEAM_MEMBER', 'team'),
    ('CREATE_MEMBER', 'company'), ('CREATE_MEMBER', 'division'), ('VIEW_MEMBERS', 'company'), ('VIEW_MEMBERS', 'division'), ('VIEW_MEMBERS', 'team'), ('VIEW_MEMBERS', 'member'), ('UPDATE_MEMBER', 'company'), ('UPDATE_MEMBER', 'division'), ('UPDATE_MEMBER', 'team'), ('REMOVE_MEMBER', 'company'), ('REMOVE_MEMBER', 'division'), ('REMOVE_MEMBER', 'team'), ('LINK_MEMBER_ACCESS', 'company'), ('LINK_MEMBER_ACCESS', 'division'), ('LINK_MEMBER_ACCESS', 'team'),
    ('VIEW_DESIGNATIONS', 'company'), ('CREATE_DESIGNATION', 'company'), ('UPDATE_DESIGNATION', 'company'), ('DELETE_DESIGNATION', 'company'),
    ('CREATE_CLIENT', 'company'), ('VIEW_CLIENTS', 'company'), ('UPDATE_CLIENT', 'company'), ('DEACTIVATE_CLIENT', 'company'), ('REACTIVATE_CLIENT', 'company'), ('CREATE_CLIENT_CONTACT', 'company'), ('VIEW_CLIENT_CONTACTS', 'company'), ('UPDATE_CLIENT_CONTACT', 'company'), ('DEACTIVATE_CLIENT_CONTACT', 'company'), ('REACTIVATE_CLIENT_CONTACT', 'company'), ('SET_PRIMARY_CLIENT_CONTACT', 'company'), ('GRANT_CLIENT_PORTAL_ACCESS', 'company'), ('REVOKE_CLIENT_PORTAL_ACCESS', 'company'),
    ('CREATE_BID', 'company'), ('CREATE_BID', 'division'), ('VIEW_BID', 'company'), ('VIEW_BID', 'division'), ('VIEW_BID', 'team'), ('VIEW_BID', 'member'), ('UPDATE_BID', 'company'), ('UPDATE_BID', 'division'), ('ARCHIVE_BID', 'company'), ('ARCHIVE_BID', 'division'), ('RESTORE_BID', 'company'), ('RESTORE_BID', 'division'), ('DECIDE_BID_OUTCOME', 'company'), ('DECIDE_BID_OUTCOME', 'division'), ('REQUEST_ARCHIVED_BID_REVIEW', 'company'), ('REQUEST_ARCHIVED_BID_REVIEW', 'division'),
    ('CREATE_PROJECT', 'company'), ('CREATE_PROJECT', 'division'), ('VIEW_PROJECT', 'company'), ('VIEW_PROJECT', 'division'), ('VIEW_PROJECT', 'team'), ('VIEW_PROJECT', 'member'), ('UPDATE_PROJECT', 'company'), ('UPDATE_PROJECT', 'division'), ('ARCHIVE_PROJECT', 'company'), ('ARCHIVE_PROJECT', 'division'), ('RESTORE_PROJECT', 'company'), ('RESTORE_PROJECT', 'division'),
    ('CREATE_WORK_REQUEST', 'company'), ('CREATE_WORK_REQUEST', 'division'), ('VIEW_WORK_REQUEST', 'company'), ('VIEW_WORK_REQUEST', 'division'), ('VIEW_WORK_REQUEST', 'team'), ('VIEW_WORK_REQUEST', 'member'), ('UPDATE_WORK_REQUEST', 'company'), ('UPDATE_WORK_REQUEST', 'division'), ('CREATE_WORK_REQUEST_NOTE', 'company'), ('CREATE_WORK_REQUEST_NOTE', 'division'), ('CREATE_WORK_REQUEST_NOTE', 'team'), ('CREATE_WORK_REQUEST_NOTE', 'member'), ('ASSIGN_WORK_REQUEST_DIVISION', 'company'), ('ASSIGN_WORK_REQUEST_DIVISION', 'division'), ('ASSIGN_WORK_REQUEST_TEAM', 'division'), ('ASSIGN_WORK_REQUEST_MEMBER', 'team'), ('SUBMIT_WORK_REQUEST', 'division'), ('SUBMIT_WORK_REQUEST', 'team'), ('SUBMIT_WORK_REQUEST', 'member'), ('APPROVE_WORK_REQUEST_REVIEW', 'team'), ('REQUEST_WORK_REQUEST_REVISION', 'division'), ('REQUEST_WORK_REQUEST_REVISION', 'team'), ('REQUEST_WORK_REQUEST_REVISION', 'member'),
    ('VIEW_DOCUMENT', 'company'), ('VIEW_DOCUMENT', 'division'), ('VIEW_DOCUMENT', 'team'), ('VIEW_DOCUMENT', 'member'), ('UPLOAD_DOCUMENT', 'company'), ('UPLOAD_DOCUMENT', 'division'), ('UPLOAD_DOCUMENT', 'team'), ('UPLOAD_DOCUMENT', 'member'), ('SUBMIT_DOCUMENT', 'member'),
    ('VIEW_DOCUMENT_CODES', 'company'), ('CREATE_DOCUMENT_CODE', 'company'), ('UPDATE_DOCUMENT_CODE', 'company'), ('DELETE_DOCUMENT_CODE', 'company'), ('DEACTIVATE_DOCUMENT_CODE', 'company'), ('REACTIVATE_DOCUMENT_CODE', 'company'),
    ('ROUTE_FOR_REVIEW', 'division'), ('ASSIGN_REVIEWER', 'team'), ('APPROVE_REVIEW', 'team'), ('REJECT_REVIEW', 'team'), ('APPROVE_ORIGIN_REVIEW', 'company'), ('APPROVE_ORIGIN_REVIEW', 'division'), ('REJECT_ORIGIN_REVIEW', 'company'), ('REJECT_ORIGIN_REVIEW', 'division'),
    ('REQUEST_INFO', 'company'), ('REQUEST_INFO', 'division'), ('REQUEST_INFO', 'team'), ('REQUEST_INFO', 'member'), ('RESPOND_TO_INFO_REQUEST', 'company'), ('RESPOND_TO_INFO_REQUEST', 'division'), ('RESPOND_TO_INFO_REQUEST', 'team'), ('RESPOND_TO_INFO_REQUEST', 'member'), ('REQUEST_REVISION', 'division'), ('REQUEST_REVISION', 'team'), ('REQUEST_REVISION', 'member'), ('SUBMIT_FOR_REVIEW', 'member'), ('ESCALATE_TO_EXTERNAL_REVIEW', 'company'), ('ESCALATE_TO_EXTERNAL_REVIEW', 'division'), ('SUBMIT_FOR_EXTERNAL_REVIEW', 'company'), ('SUBMIT_FOR_EXTERNAL_REVIEW', 'division'), ('SUBMIT_CLIENT_REVISION', 'company'), ('SUBMIT_CLIENT_REVISION', 'division'),
    ('VIEW_SETTINGS', 'company'), ('UPDATE_SETTINGS', 'company'),
    ('VIEW_REFERENCE_DATA', 'company'), ('CREATE_REFERENCE_DATA_OPTION', 'company'), ('UPDATE_REFERENCE_DATA_OPTION', 'company'), ('DEACTIVATE_REFERENCE_DATA_OPTION', 'company'), ('REACTIVATE_REFERENCE_DATA_OPTION', 'company')
) AS desired(code, scope)
  ON permission.code = desired.code;

-- Keep the database-owned protected-starter reconciliation bundle in lockstep
-- with the runtime definition. This supersedes only the function body; its
-- existing workspace-provisioning caller remains valid and resolves this new
-- definition by function identity.
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

  IF EXISTS (
    SELECT 1
    FROM (
      VALUES
        ('staff'::text, 'member'::public.custom_role_scope, 'VIEW_MEMBERS'::public.permission_code),
        ('staff', 'member', 'VIEW_BID'),
        ('staff', 'member', 'VIEW_PROJECT'),
        ('staff', 'member', 'VIEW_WORK_REQUEST'),
        ('staff', 'member', 'VIEW_DOCUMENT'),
        ('supervisor', 'team', 'VIEW_MEMBERS'),
        ('supervisor', 'team', 'VIEW_BID'),
        ('supervisor', 'team', 'VIEW_PROJECT'),
        ('supervisor', 'team', 'VIEW_WORK_REQUEST'),
        ('supervisor', 'team', 'VIEW_DOCUMENT'),
        ('supervisor', 'team', 'VIEW_TEAMS'),
        ('supervisor', 'team', 'ASSIGN_WORK_REQUEST_MEMBER'),
        ('supervisor', 'team', 'APPROVE_WORK_REQUEST_REVIEW'),
        ('supervisor', 'team', 'REQUEST_WORK_REQUEST_REVISION'),
        ('supervisor', 'team', 'REQUEST_INFO'),
        ('supervisor', 'team', 'RESPOND_TO_INFO_REQUEST'),
        ('manager', 'division', 'VIEW_MEMBERS'),
        ('manager', 'division', 'VIEW_BID'),
        ('manager', 'division', 'VIEW_PROJECT'),
        ('manager', 'division', 'VIEW_WORK_REQUEST'),
        ('manager', 'division', 'VIEW_DOCUMENT'),
        ('manager', 'division', 'VIEW_TEAMS'),
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
             SELECT 1 FROM public.system_roles AS system_role
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

  INSERT INTO public.role_permissions (tenant_id, role_id, permission_id)
  SELECT p_tenant_id, role_definition.id, permission.id
  FROM (
    VALUES
      ('staff'::text, 'VIEW_MEMBERS'::public.permission_code),
      ('staff', 'VIEW_BID'), ('staff', 'VIEW_PROJECT'),
      ('staff', 'VIEW_WORK_REQUEST'), ('staff', 'VIEW_DOCUMENT'),
      ('supervisor', 'VIEW_MEMBERS'), ('supervisor', 'VIEW_BID'),
      ('supervisor', 'VIEW_PROJECT'), ('supervisor', 'VIEW_WORK_REQUEST'),
      ('supervisor', 'VIEW_DOCUMENT'), ('supervisor', 'VIEW_TEAMS'),
      ('supervisor', 'ASSIGN_WORK_REQUEST_MEMBER'),
      ('supervisor', 'APPROVE_WORK_REQUEST_REVIEW'),
      ('supervisor', 'REQUEST_WORK_REQUEST_REVISION'),
      ('supervisor', 'REQUEST_INFO'), ('supervisor', 'RESPOND_TO_INFO_REQUEST'),
      ('manager', 'VIEW_MEMBERS'), ('manager', 'VIEW_BID'),
      ('manager', 'VIEW_PROJECT'), ('manager', 'VIEW_WORK_REQUEST'),
      ('manager', 'VIEW_DOCUMENT'), ('manager', 'VIEW_TEAMS'),
      ('manager', 'REQUEST_WORK_REQUEST_REVISION'),
      ('manager', 'REQUEST_INFO'), ('manager', 'RESPOND_TO_INFO_REQUEST'),
      ('manager', 'VIEW_DIVISIONS'), ('manager', 'ASSIGN_WORK_REQUEST_TEAM')
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

-- Re-run the idempotent reconciliation after revoking stale grants so every
-- tenant has the narrowed, compatible protected bundle.
DO $migration$
DECLARE
  v_tenant record;
BEGIN
  FOR v_tenant IN SELECT id FROM public.tenants LOOP
    PERFORM public.reconcile_tenant_starter_roles(v_tenant.id);
  END LOOP;
END;
$migration$;

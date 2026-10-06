-- Extend the final permission catalogue from 89 to the owner-frozen 101
-- capabilities. Historical migrations and legacy workflow-action tables remain
-- unchanged.
--
-- Rollback: revoke the twelve new role grants, remove their compatibility and
-- catalogue rows, then rebuild permission_code/permission_category without the
-- new enum labels. Restore the captured provisioning function only after the
-- enum rollback is complete.

-- PostgreSQL does not permit a newly-added enum value to be used until commit.
-- Rebuilding the two small catalogue enums in this forward migration keeps the
-- code, metadata, compatibility, and signup invariant atomic.
DO $migration$
DECLARE
  v_provision_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.provision_company_workspace_core(text,text,uuid,text,text,text,text,text)'::regprocedure
  ) INTO v_provision_definition;

  IF position('<> 89' IN v_provision_definition) = 0 THEN
    RAISE EXCEPTION 'Cannot expand final permission catalogue: expected 89-permission bootstrap was not found'
      USING ERRCODE = '55000';
  END IF;

  DROP TRIGGER IF EXISTS role_permissions_role_tenant_match ON public.role_permissions;
  DROP FUNCTION public.assert_role_permission_tenant_match();
  DROP FUNCTION public.provision_company_workspace_core(text, text, uuid, text, text, text, text, text);

  CREATE TYPE public.permission_code_v2 AS ENUM (
    'VIEW_ROLES', 'CREATE_ROLE', 'UPDATE_ROLE', 'RETIRE_ROLE', 'ASSIGN_ROLES', 'REVOKE_ROLES',
    'CREATE_USER', 'VIEW_USERS', 'UPDATE_USER', 'DELETE_USER', 'REVOKE_USER_SESSIONS',
    'CREATE_COMPANY', 'VIEW_COMPANY', 'UPDATE_COMPANY',
    'CREATE_DIVISION', 'VIEW_DIVISIONS', 'UPDATE_DIVISION', 'DELETE_DIVISION', 'ASSIGN_DIVISION_LEAD', 'REVOKE_DIVISION_LEAD',
    'CREATE_TEAM', 'VIEW_TEAMS', 'UPDATE_TEAM', 'DELETE_TEAM', 'ASSIGN_TEAM_MEMBER', 'REMOVE_TEAM_MEMBER',
    'CREATE_MEMBER', 'VIEW_MEMBERS', 'UPDATE_MEMBER', 'REMOVE_MEMBER', 'LINK_MEMBER_ACCESS', 'VIEW_DESIGNATIONS', 'CREATE_DESIGNATION', 'UPDATE_DESIGNATION', 'DELETE_DESIGNATION',
    'CREATE_CLIENT', 'VIEW_CLIENTS', 'UPDATE_CLIENT', 'DEACTIVATE_CLIENT', 'REACTIVATE_CLIENT', 'CREATE_CLIENT_CONTACT', 'VIEW_CLIENT_CONTACTS', 'UPDATE_CLIENT_CONTACT', 'DEACTIVATE_CLIENT_CONTACT', 'REACTIVATE_CLIENT_CONTACT', 'SET_PRIMARY_CLIENT_CONTACT', 'GRANT_CLIENT_PORTAL_ACCESS', 'REVOKE_CLIENT_PORTAL_ACCESS',
    'CREATE_BID', 'VIEW_BID', 'UPDATE_BID', 'ARCHIVE_BID', 'RESTORE_BID', 'DECIDE_BID_OUTCOME', 'REQUEST_ARCHIVED_BID_REVIEW',
    'CREATE_PROJECT', 'VIEW_PROJECT', 'UPDATE_PROJECT', 'ARCHIVE_PROJECT', 'RESTORE_PROJECT',
    'CREATE_WORK_REQUEST', 'VIEW_WORK_REQUEST', 'UPDATE_WORK_REQUEST', 'CREATE_WORK_REQUEST_NOTE', 'ASSIGN_WORK_REQUEST_DIVISION', 'ASSIGN_WORK_REQUEST_TEAM', 'ASSIGN_WORK_REQUEST_MEMBER', 'SUBMIT_WORK_REQUEST', 'APPROVE_WORK_REQUEST_REVIEW', 'REQUEST_WORK_REQUEST_REVISION',
    'VIEW_DOCUMENT', 'UPLOAD_DOCUMENT', 'SUBMIT_DOCUMENT',
    'VIEW_DOCUMENT_CODES', 'CREATE_DOCUMENT_CODE', 'UPDATE_DOCUMENT_CODE', 'DELETE_DOCUMENT_CODE', 'DEACTIVATE_DOCUMENT_CODE', 'REACTIVATE_DOCUMENT_CODE',
    'ROUTE_FOR_REVIEW', 'ASSIGN_REVIEWER', 'APPROVE_REVIEW', 'REJECT_REVIEW', 'APPROVE_ORIGIN_REVIEW', 'REJECT_ORIGIN_REVIEW',
    'REQUEST_INFO', 'RESPOND_TO_INFO_REQUEST', 'REQUEST_REVISION', 'SUBMIT_FOR_REVIEW', 'ESCALATE_TO_EXTERNAL_REVIEW', 'SUBMIT_FOR_EXTERNAL_REVIEW', 'SUBMIT_CLIENT_REVISION', 'ACCEPT_FINAL_DELIVERY', 'REJECT_FINAL_DELIVERY',
    'VIEW_SETTINGS', 'UPDATE_SETTINGS',
    'VIEW_REFERENCE_DATA', 'CREATE_REFERENCE_DATA_OPTION', 'UPDATE_REFERENCE_DATA_OPTION', 'DEACTIVATE_REFERENCE_DATA_OPTION', 'REACTIVATE_REFERENCE_DATA_OPTION'
  );
  ALTER TABLE public.permissions ALTER COLUMN code TYPE public.permission_code_v2
    USING code::text::public.permission_code_v2;
  DROP TYPE public.permission_code;
  ALTER TYPE public.permission_code_v2 RENAME TO permission_code;

  CREATE TYPE public.permission_category_v2 AS ENUM (
    'ACCESS_CONTROL', 'REFERENCE_DATA', 'ORGANIZATION', 'DIVISIONS', 'TEAMS', 'MEMBERS', 'CLIENTS', 'BIDS',
    'PROJECTS', 'WORK_REQUESTS', 'DOCUMENTS', 'DOCUMENT_CODES', 'REVIEWS', 'WORKFLOW', 'SETTINGS'
  );
  ALTER TABLE public.permissions ALTER COLUMN category TYPE public.permission_category_v2
    USING category::text::public.permission_category_v2;
  DROP TYPE public.permission_category;
  ALTER TYPE public.permission_category_v2 RENAME TO permission_category;

  v_provision_definition := replace(v_provision_definition, '<> 89', '<> 101');
  EXECUTE v_provision_definition;
END;
$migration$;

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
        (role_definition.is_system_role = true AND EXISTS (
          SELECT 1 FROM public.system_roles AS system_role
          WHERE system_role.role_id = role_definition.id
            AND system_role.system_code = 'tenant_super_admin'::public.actor_role_code
        ) AND NOT EXISTS (
          SELECT 1 FROM public.permissions AS permission
          WHERE permission.id = NEW.permission_id
            AND permission.code = 'DECIDE_BID_OUTCOME'::public.permission_code
        ))
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
    RAISE EXCEPTION 'Role permission must target a compatible active custom role or tenant_super_admin without DECIDE_BID_OUTCOME'
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE CONSTRAINT TRIGGER role_permissions_role_tenant_match
AFTER INSERT OR UPDATE OF tenant_id, role_id ON public.role_permissions
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION public.assert_role_permission_tenant_match();

INSERT INTO public.permissions (code, display_name, description, category, action_type, resource) VALUES
  ('CREATE_USER', 'Create user', 'Create a tenant user without implicitly assigning a role or actor profile.', 'ACCESS_CONTROL', 'CREATE', 'User'),
  ('VIEW_USERS', 'View users', 'View tenant users.', 'ACCESS_CONTROL', 'VIEW', 'User'),
  ('UPDATE_USER', 'Update user', 'Update a tenant user subject to final-administrator safety.', 'ACCESS_CONTROL', 'UPDATE', 'User'),
  ('DELETE_USER', 'Delete user', 'Hard delete a tenant user only when dependency and final-administrator rules allow.', 'ACCESS_CONTROL', 'DELETE', 'User'),
  ('REVOKE_USER_SESSIONS', 'Revoke user sessions', 'Revoke all active sessions for a tenant user.', 'ACCESS_CONTROL', 'REVOKE', 'Auth session'),
  ('VIEW_REFERENCE_DATA', 'View reference data', 'View tenant reference-data options.', 'REFERENCE_DATA', 'VIEW', 'Reference-data option'),
  ('CREATE_REFERENCE_DATA_OPTION', 'Create reference-data option', 'Create a tenant reference-data option.', 'REFERENCE_DATA', 'CREATE', 'Reference-data option'),
  ('UPDATE_REFERENCE_DATA_OPTION', 'Update reference-data option', 'Update a tenant reference-data option.', 'REFERENCE_DATA', 'UPDATE', 'Reference-data option'),
  ('DEACTIVATE_REFERENCE_DATA_OPTION', 'Deactivate reference-data option', 'Deactivate a tenant reference-data option.', 'REFERENCE_DATA', 'OTHER', 'Reference-data option'),
  ('REACTIVATE_REFERENCE_DATA_OPTION', 'Reactivate reference-data option', 'Reactivate a tenant reference-data option.', 'REFERENCE_DATA', 'OTHER', 'Reference-data option'),
  ('DEACTIVATE_DOCUMENT_CODE', 'Deactivate document code', 'Deactivate a tenant document code.', 'DOCUMENT_CODES', 'OTHER', 'Document code'),
  ('REACTIVATE_DOCUMENT_CODE', 'Reactivate document code', 'Reactivate a tenant document code.', 'DOCUMENT_CODES', 'OTHER', 'Document code');

WITH compatibility (code, scopes) AS (
  VALUES
    ('CREATE_USER'::public.permission_code, ARRAY['company']::public.custom_role_scope[]),
    ('VIEW_USERS'::public.permission_code, ARRAY['company']::public.custom_role_scope[]),
    ('UPDATE_USER'::public.permission_code, ARRAY['company']::public.custom_role_scope[]),
    ('DELETE_USER'::public.permission_code, ARRAY['company']::public.custom_role_scope[]),
    ('REVOKE_USER_SESSIONS'::public.permission_code, ARRAY['company']::public.custom_role_scope[]),
    ('VIEW_REFERENCE_DATA'::public.permission_code, ARRAY['company']::public.custom_role_scope[]),
    ('CREATE_REFERENCE_DATA_OPTION'::public.permission_code, ARRAY['company']::public.custom_role_scope[]),
    ('UPDATE_REFERENCE_DATA_OPTION'::public.permission_code, ARRAY['company']::public.custom_role_scope[]),
    ('DEACTIVATE_REFERENCE_DATA_OPTION'::public.permission_code, ARRAY['company']::public.custom_role_scope[]),
    ('REACTIVATE_REFERENCE_DATA_OPTION'::public.permission_code, ARRAY['company']::public.custom_role_scope[]),
    ('DEACTIVATE_DOCUMENT_CODE'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[]),
    ('REACTIVATE_DOCUMENT_CODE'::public.permission_code, ARRAY['company','division','team','member']::public.custom_role_scope[])
)
INSERT INTO public.permission_scope_compatibilities (permission_id, scope)
SELECT permission.id, unnest(compatibility.scopes)
FROM compatibility
JOIN public.permissions AS permission ON permission.code = compatibility.code;

REVOKE ALL ON FUNCTION public.provision_company_workspace_core(text, text, uuid, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.provision_company_workspace_core(text, text, uuid, text, text, text, text, text) FROM app_user;

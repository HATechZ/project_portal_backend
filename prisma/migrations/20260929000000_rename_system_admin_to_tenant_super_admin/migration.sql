-- Rename the fixed tenant/company administrator enum identity in place.
-- The enum label update retains the same SystemRole row and Role id, so the
-- existing UserRole, ActorProfile, and workflow_action_role_permissions rows
-- retain their relationships without copying or recreating data.
--
-- Rollback: ALTER TYPE public.actor_role_code RENAME VALUE
--   'tenant_super_admin' TO 'system_admin'; then recreate the provisioning
-- function from the preceding migration or replace its identifier text back.

ALTER TYPE public.actor_role_code
  RENAME VALUE 'system_admin' TO 'tenant_super_admin';

UPDATE public.roles AS role
SET
  name = 'Tenant Super Administrator',
  description = 'Highest administrator for this tenant/company; access remains permission and scope driven.'
FROM public.system_roles AS system_role
WHERE system_role.role_id = role.id
  AND system_role.system_code = 'tenant_super_admin'::public.actor_role_code;

-- PL/pgSQL stores its source text. Recreate the current workspace provisioning
-- function so future tenants resolve only the renamed fixed role. Its role id,
-- grants, SECURITY DEFINER attribute, and all non-role behavior are retained.
DO $migration$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.provision_company_workspace_core(text, text, uuid, text, text, text, text, text)'::regprocedure
  ) INTO v_definition;

  IF position('system_admin' IN v_definition) > 0 THEN
    EXECUTE replace(v_definition, 'system_admin', 'tenant_super_admin');
  END IF;
END;
$migration$;

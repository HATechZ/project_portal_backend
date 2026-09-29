-- Backfill the approved Work Request permissions for the renamed fixed
-- tenant/company administrator. This is intentionally limited to the seven
-- actions the former tenant supervisor received through normal provisioning.
-- It does not change authorization scope or grant any cross-tenant access.
--
-- Rollback: set allowed = false only for tenant/action rows whose prior state
-- is known from a backup. This migration may re-enable a previously disabled
-- approved action, so an unconditional rollback would lose administrator
-- intent.

DO $migration$
BEGIN
  IF (SELECT count(*) FROM public.system_roles
      WHERE system_code = 'tenant_super_admin'::public.actor_role_code) <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one tenant_super_admin system role';
  END IF;

  IF (SELECT count(*) FROM public.workflow_action_definitions
      WHERE code IN (
        'ADD_WORK_REQUEST'::public.workflow_action_code,
        'ADD_WORK_REQUEST_DOCUMENT'::public.workflow_action_code,
        'ADD_WORK_REQUEST_NOTE'::public.workflow_action_code,
        'REQUEST_WORKFLOW_INFO'::public.workflow_action_code,
        'RESPOND_WORKFLOW_INFO'::public.workflow_action_code,
        'VIEW_WORK_REQUEST'::public.workflow_action_code,
        'UPDATE_WORK_REQUEST'::public.workflow_action_code
      )) <> 7 THEN
    RAISE EXCEPTION 'Expected all approved tenant_super_admin Work Request actions';
  END IF;
END;
$migration$;

INSERT INTO public.workflow_action_role_permissions
  (tenant_id, id, action_id, role_id, allowed)
SELECT
  tenant.id,
  gen_random_uuid(),
  action_definition.id,
  system_role.role_id,
  true
FROM public.tenants AS tenant
CROSS JOIN public.system_roles AS system_role
CROSS JOIN public.workflow_action_definitions AS action_definition
WHERE system_role.system_code = 'tenant_super_admin'::public.actor_role_code
  AND action_definition.code IN (
    'ADD_WORK_REQUEST'::public.workflow_action_code,
    'ADD_WORK_REQUEST_DOCUMENT'::public.workflow_action_code,
    'ADD_WORK_REQUEST_NOTE'::public.workflow_action_code,
    'REQUEST_WORKFLOW_INFO'::public.workflow_action_code,
    'RESPOND_WORKFLOW_INFO'::public.workflow_action_code,
    'VIEW_WORK_REQUEST'::public.workflow_action_code,
    'UPDATE_WORK_REQUEST'::public.workflow_action_code
  )
ON CONFLICT (tenant_id, action_id, role_id)
DO UPDATE SET allowed = true;

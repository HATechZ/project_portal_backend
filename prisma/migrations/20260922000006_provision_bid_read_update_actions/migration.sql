-- Provision owner-locked Bid read/update actions through the existing action-grant
-- catalogue. ADD_BID remains the create action. No runtime role comparison is
-- introduced by this migration.
--
-- Rollback: delete these actions' permission rows and definitions only after
-- confirming no tenant or audit data depends on them. Enum rollback is documented
-- in 20260922000005_add_bid_read_update_actions.

INSERT INTO public.workflow_action_definitions (
  id, code, name, description, is_user_visible, is_revision_action,
  is_info_request_action, is_assignment_action, is_terminal_action
)
VALUES
  (gen_random_uuid(), 'VIEW_BID'::public.workflow_action_code, 'View Bid',
   'Allows the view bid action.', true, false, false, false, false),
  (gen_random_uuid(), 'UPDATE_BID'::public.workflow_action_code, 'Update Bid',
   'Allows the update bid action.', true, false, false, false, false)
ON CONFLICT (code) DO NOTHING;

-- Existing tenants receive complete system-role rows. The approved policy is:
-- system_admin and ccr_coordinator may read and update; division_head and
-- division_lead may read only. Custom roles receive no implicit grant.
INSERT INTO public.workflow_action_role_permissions (
  tenant_id, id, action_id, role_id, allowed
)
SELECT
  tenant.id,
  gen_random_uuid(),
  action_definition.id,
  system_role.role_id,
  CASE action_definition.code
    WHEN 'VIEW_BID'::public.workflow_action_code THEN system_role.system_code IN (
      'system_admin'::public.actor_role_code,
      'ccr_coordinator'::public.actor_role_code,
      'division_head'::public.actor_role_code,
      'division_lead'::public.actor_role_code
    )
    WHEN 'UPDATE_BID'::public.workflow_action_code THEN system_role.system_code IN (
      'system_admin'::public.actor_role_code,
      'ccr_coordinator'::public.actor_role_code
    )
    ELSE false
  END
FROM public.tenants AS tenant
CROSS JOIN public.system_roles AS system_role
CROSS JOIN public.workflow_action_definitions AS action_definition
WHERE action_definition.code IN (
  'VIEW_BID'::public.workflow_action_code,
  'UPDATE_BID'::public.workflow_action_code
)
ON CONFLICT (tenant_id, action_id, role_id)
DO UPDATE SET allowed = EXCLUDED.allowed;

-- New-tenant provisioning stays centralized in the authoritative workspace
-- provisioning function. Add explicit rows after its baseline permission matrix,
-- so the locked Bid policy overrides the general role defaults.
DO $$
DECLARE
  v_definition text;
  v_anchor text := '  IF (SELECT count(*)';
  v_insertion text := $sql$
  INSERT INTO public.workflow_action_role_permissions (tenant_id, id, action_id, role_id, allowed)
  SELECT v_tenant_id, gen_random_uuid(), action_definition.id, system_role.role_id,
    CASE action_definition.code
      WHEN 'VIEW_BID'::public.workflow_action_code THEN system_role.system_code IN (
        'system_admin'::public.actor_role_code,
        'ccr_coordinator'::public.actor_role_code,
        'division_head'::public.actor_role_code,
        'division_lead'::public.actor_role_code
      )
      WHEN 'UPDATE_BID'::public.workflow_action_code THEN system_role.system_code IN (
        'system_admin'::public.actor_role_code,
        'ccr_coordinator'::public.actor_role_code
      )
      ELSE false
    END
  FROM public.system_roles AS system_role
  CROSS JOIN public.workflow_action_definitions AS action_definition
  WHERE action_definition.code IN (
    'VIEW_BID'::public.workflow_action_code,
    'UPDATE_BID'::public.workflow_action_code
  )
  ON CONFLICT (tenant_id, action_id, role_id) DO UPDATE SET allowed = EXCLUDED.allowed;
$sql$;
BEGIN
  SELECT pg_get_functiondef(
    'public.provision_company_workspace_core(text,text,uuid,text,text,text,text,text)'::regprocedure
  ) INTO v_definition;

  IF position('VIEW_BID' IN v_definition) > 0
     AND position('UPDATE_BID' IN v_definition) > 0 THEN
    RETURN;
  END IF;

  IF position(v_anchor IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Cannot update tenant provisioning: expected permission-matrix anchor was not found'
      USING ERRCODE = '55000';
  END IF;

  v_definition := replace(v_definition, v_anchor, v_insertion || E'\n' || v_anchor);
  EXECUTE v_definition;
END $$;

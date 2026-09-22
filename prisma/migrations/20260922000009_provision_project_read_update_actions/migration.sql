-- Provision owner-locked Module 09 Project action grants after the prior
-- migration commits the VIEW_PROJECT and UPDATE_PROJECT enum values.
--
-- Rollback: remove Project action permission rows and definitions only after
-- checking that no tenant policy or audit history depends on them.  Enum
-- rollback requires a deliberate workflow_action_code rebuild.

INSERT INTO public.workflow_action_definitions (id, code, name, description, is_user_visible, is_revision_action, is_info_request_action, is_assignment_action, is_terminal_action)
VALUES
  (gen_random_uuid(), 'ADD_PROJECT'::public.workflow_action_code, 'Add Project', 'Allows the add project action.', true, false, false, false, false),
  (gen_random_uuid(), 'VIEW_PROJECT'::public.workflow_action_code, 'View Project', 'Allows the view project action.', true, false, false, false, false),
  (gen_random_uuid(), 'UPDATE_PROJECT'::public.workflow_action_code, 'Update Project', 'Allows the update project action.', true, false, false, false, false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.workflow_action_role_permissions (tenant_id, id, action_id, role_id, allowed)
SELECT tenant.id, gen_random_uuid(), action_definition.id, system_role.role_id,
  CASE action_definition.code
    WHEN 'ADD_PROJECT'::public.workflow_action_code THEN system_role.system_code IN ('system_admin'::public.actor_role_code, 'ccr_coordinator'::public.actor_role_code)
    WHEN 'VIEW_PROJECT'::public.workflow_action_code THEN system_role.system_code IN ('system_admin'::public.actor_role_code, 'ccr_coordinator'::public.actor_role_code, 'division_head'::public.actor_role_code, 'division_lead'::public.actor_role_code)
    WHEN 'UPDATE_PROJECT'::public.workflow_action_code THEN system_role.system_code IN ('system_admin'::public.actor_role_code, 'ccr_coordinator'::public.actor_role_code)
    ELSE false
  END
FROM public.tenants AS tenant CROSS JOIN public.system_roles AS system_role CROSS JOIN public.workflow_action_definitions AS action_definition
WHERE action_definition.code IN ('ADD_PROJECT'::public.workflow_action_code, 'VIEW_PROJECT'::public.workflow_action_code, 'UPDATE_PROJECT'::public.workflow_action_code)
ON CONFLICT (tenant_id, action_id, role_id) DO UPDATE SET allowed = EXCLUDED.allowed;

DO $$
DECLARE v_definition text; v_anchor text := '  IF (SELECT count(*)'; v_insertion text := $sql$
  INSERT INTO public.workflow_action_role_permissions (tenant_id, id, action_id, role_id, allowed)
  SELECT v_tenant_id, gen_random_uuid(), action_definition.id, system_role.role_id,
    CASE action_definition.code
      WHEN 'ADD_PROJECT'::public.workflow_action_code THEN system_role.system_code IN ('system_admin'::public.actor_role_code, 'ccr_coordinator'::public.actor_role_code)
      WHEN 'VIEW_PROJECT'::public.workflow_action_code THEN system_role.system_code IN ('system_admin'::public.actor_role_code, 'ccr_coordinator'::public.actor_role_code, 'division_head'::public.actor_role_code, 'division_lead'::public.actor_role_code)
      WHEN 'UPDATE_PROJECT'::public.workflow_action_code THEN system_role.system_code IN ('system_admin'::public.actor_role_code, 'ccr_coordinator'::public.actor_role_code)
      ELSE false
    END
  FROM public.system_roles AS system_role CROSS JOIN public.workflow_action_definitions AS action_definition
  WHERE action_definition.code IN ('ADD_PROJECT'::public.workflow_action_code, 'VIEW_PROJECT'::public.workflow_action_code, 'UPDATE_PROJECT'::public.workflow_action_code)
  ON CONFLICT (tenant_id, action_id, role_id) DO UPDATE SET allowed = EXCLUDED.allowed;
$sql$;
BEGIN
  SELECT pg_get_functiondef('public.provision_company_workspace_core(text,text,uuid,text,text,text,text,text)'::regprocedure) INTO v_definition;
  IF position('VIEW_PROJECT' IN v_definition) > 0 AND position('UPDATE_PROJECT' IN v_definition) > 0 THEN RETURN; END IF;
  IF position(v_anchor IN v_definition) = 0 THEN RAISE EXCEPTION 'Cannot update tenant provisioning: expected permission-matrix anchor was not found' USING ERRCODE = '55000'; END IF;
  v_definition := replace(v_definition, v_anchor, v_insertion || E'\n' || v_anchor);
  EXECUTE v_definition;
END $$;

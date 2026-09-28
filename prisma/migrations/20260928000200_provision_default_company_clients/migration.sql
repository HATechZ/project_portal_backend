-- Initialize the ordinary, editable Client starter records inside the existing
-- company-workspace provisioning transaction. This changes no table shape and
-- preserves the current function's grants, owner, SECURITY DEFINER attribute,
-- and unrelated provisioning behavior by rebuilding its current definition.
--
-- Rollback: recreate the immediately preceding provision_company_workspace_core
-- definition. Existing Client and ClientContact rows are user-editable business
-- data and must not be deleted by a rollback.

DO $migration$
DECLARE
  v_definition text;
  v_old_return text := $old$
  RETURN QUERY SELECT v_tenant_id, v_company_id, v_user_id, v_user_role_id, v_actor_profile_id;$old$;
  v_new_return text := $new$
  -- These are normal Client and ClientContact records. They are created only as
  -- part of a new workspace and are never subsequently refreshed or locked.
  WITH default_clients (id, name, contact_name, contact_email, contact_designation) AS (
    VALUES
      (gen_random_uuid(), 'Bluewater Marine Logistics', 'Nadia Rahman', 'nadia.rahman@bluewater-marine.test', 'Commercial Manager'),
      (gen_random_uuid(), 'Meridian Offshore Services', 'Arif Hossain', 'arif.hossain@meridian-offshore.test', 'Operations Director'),
      (gen_random_uuid(), 'Seaport Engineering Partners', 'Farzana Islam', 'farzana.islam@seaport-engineering.test', 'Project Controls Lead')
  ),
  inserted_clients AS (
    INSERT INTO public.clients (tenant_id, id, company_id, name, is_active)
    SELECT v_tenant_id, default_client.id, v_company_id, default_client.name, true
    FROM default_clients AS default_client
    RETURNING id
  )
  INSERT INTO public.client_contacts (
    tenant_id, id, client_id, name, email, designation, is_primary, is_active
  )
  SELECT
    v_tenant_id,
    gen_random_uuid(),
    default_client.id,
    default_client.contact_name,
    default_client.contact_email,
    default_client.contact_designation,
    true,
    true
  FROM default_clients AS default_client
  JOIN inserted_clients ON inserted_clients.id = default_client.id;

  RETURN QUERY SELECT v_tenant_id, v_company_id, v_user_id, v_user_role_id, v_actor_profile_id;$new$;
BEGIN
  SELECT pg_get_functiondef(
    'public.provision_company_workspace_core(text, text, uuid, text, text, text, text, text)'::regprocedure
  ) INTO v_definition;

  IF position(v_old_return IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Expected workspace provisioning return statement was not found in provision_company_workspace_core';
  END IF;

  v_definition := replace(v_definition, v_old_return, v_new_return);
  EXECUTE v_definition;
END;
$migration$;

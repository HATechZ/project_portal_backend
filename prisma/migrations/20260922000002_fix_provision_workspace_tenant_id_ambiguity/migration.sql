-- Restore the qualified permission-matrix completeness check after
-- 20260921000001 recreated the provisioning function without the correction
-- from 20260916000001. The body also includes the later designation grant.
--
-- Rollback: recreate this function from the immediately preceding definition
-- only if the General Document Code and Designation provisioning additions are
-- simultaneously rolled back. This migration changes no provisioned data.

CREATE OR REPLACE FUNCTION public.provision_company_workspace_core(
  p_company_name text, p_company_abbr text, p_company_type_id uuid,
  p_admin_full_name text, p_admin_email text, p_admin_password_hash text,
  p_admin_country text, p_admin_phone text
)
RETURNS TABLE (tenant_id uuid, company_id uuid, user_id uuid, user_role_id uuid, actor_profile_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $function$
DECLARE
  v_tenant_id uuid := gen_random_uuid(); v_company_id uuid := gen_random_uuid();
  v_user_id uuid := gen_random_uuid(); v_user_role_id uuid := gen_random_uuid();
  v_actor_profile_id uuid := gen_random_uuid(); v_system_admin_role_id uuid;
  v_slug text; v_role_count integer; v_action_count integer;
BEGIN
  p_company_name := btrim(p_company_name); p_company_abbr := btrim(p_company_abbr);
  p_admin_full_name := btrim(p_admin_full_name); p_admin_email := lower(btrim(p_admin_email));
  p_admin_country := btrim(p_admin_country); p_admin_phone := btrim(p_admin_phone);
  IF p_company_name = '' OR p_company_abbr = '' OR p_admin_full_name = ''
     OR p_admin_email = '' OR p_admin_password_hash = '' OR p_admin_country = '' OR p_admin_phone = '' THEN
    RAISE EXCEPTION 'Company workspace provisioning fields must be non-empty' USING ERRCODE = '22023';
  END IF;
  IF length(p_company_name) > 180 OR length(p_company_abbr) > 30 OR length(p_admin_full_name) > 160
     OR length(p_admin_email) > 255 OR length(p_admin_password_hash) > 255 OR length(p_admin_country) > 100
     OR length(p_admin_phone) > 60 THEN
    RAISE EXCEPTION 'Company workspace provisioning field exceeds its maximum length' USING ERRCODE = '22001';
  END IF;
  PERFORM 1 FROM public.company_types AS ct WHERE ct.id = p_company_type_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown companyTypeId' USING ERRCODE = '23503'; END IF;
  SELECT sr.role_id INTO STRICT v_system_admin_role_id FROM public.system_roles sr
    WHERE sr.system_code = 'system_admin'::public.actor_role_code;
  SELECT count(*) INTO v_role_count FROM public.system_roles;
  IF v_role_count <> cardinality(enum_range(NULL::public.actor_role_code)) THEN
    RAISE EXCEPTION 'Required system role reference set is incomplete';
  END IF;
  SELECT count(*) INTO v_action_count FROM public.workflow_action_definitions;
  IF v_action_count <> cardinality(enum_range(NULL::public.workflow_action_code)) THEN
    RAISE EXCEPTION 'Required workflow action reference set is incomplete';
  END IF;
  v_slug := left(nullif(regexp_replace(lower(p_company_name), '[^a-z0-9]+', '-', 'g'), ''), 80);
  IF v_slug IS NULL THEN v_slug := 'company'; END IF;
  v_slug := trim(BOTH '-' FROM v_slug) || '-' || left(replace(v_tenant_id::text, '-', ''), 12);
  INSERT INTO public.tenants (id, name, slug, is_active) VALUES (v_tenant_id, p_company_name, v_slug, true);
  INSERT INTO public.companies (tenant_id, id, name, abbr, company_type_id, is_active)
    VALUES (v_tenant_id, v_company_id, p_company_name, p_company_abbr, p_company_type_id, true);
  INSERT INTO public.users (tenant_id, id, full_name, email, password_hash, country, phone, is_active)
    VALUES (v_tenant_id, v_user_id, p_admin_full_name, p_admin_email, p_admin_password_hash, p_admin_country, p_admin_phone, true);
  INSERT INTO public.user_roles (tenant_id, id, user_id, role_id, assigned_by_user_id)
    VALUES (v_tenant_id, v_user_role_id, v_user_id, v_system_admin_role_id, NULL);
  INSERT INTO public.actor_profiles (tenant_id, id, user_id, role_id, member_id, client_contact_id, label, is_default, is_active)
    VALUES (v_tenant_id, v_actor_profile_id, v_user_id, v_system_admin_role_id, NULL, NULL, p_admin_full_name, true, true);
  INSERT INTO public.workflow_action_role_permissions (tenant_id, id, action_id, role_id, allowed)
  SELECT v_tenant_id, gen_random_uuid(), action_definition.id, system_role.role_id,
    CASE system_role.system_code
      WHEN 'system_admin'::public.actor_role_code THEN action_definition.code <> 'DECIDE_BID_OUTCOME'::public.workflow_action_code
      WHEN 'ccr_coordinator'::public.actor_role_code THEN action_definition.code::text = ANY (ARRAY['ADD_PROJECT','ADD_BID','ADD_CLIENT_DOCUMENT','ADD_WORK_REQUEST','MARKETING_RETURN_TO_PM','MARKETING_ESCALATE_TO_CLIENT','MARKETING_SUBMIT_TO_CLIENT','MARKETING_REQUEST_ENGINEERING_REVISION','MARKETING_ROUTE_CLIENT_REVISION_TO_TMS','MARKETING_SUBMIT_CLIENT_REVISION','LIST_FINAL_DOCUMENT','REQUEST_ARCHIVED_BID_REVIEW','ADD_WORK_REQUEST_DOCUMENT','ADD_WORK_REQUEST_NOTE','REQUEST_WORKFLOW_INFO','RESPOND_WORKFLOW_INFO'])
      WHEN 'division_head'::public.actor_role_code THEN action_definition.code::text = ANY (ARRAY['ADD_DIVISION','ADD_TEAM','ASSIGN_LEADER','MANAGE_GENERAL_DOCUMENT_CODES'])
      WHEN 'division_lead'::public.actor_role_code THEN action_definition.code::text = ANY (ARRAY['ADD_TEAM','REQUEST_INFO_FROM_MARKETING','PM_LEAD_RESPOND_TO_MEMBER','PM_RETURN_TO_MEMBER','ASSIGN_MEMBER','FORWARD_TO_TMS','ORIGIN_MANAGER_APPROVE','FORWARD_TO_CCR','ADD_WORK_REQUEST_DOCUMENT','ADD_WORK_REQUEST_NOTE','REQUEST_WORKFLOW_INFO','RESPOND_WORKFLOW_INFO','MANAGE_GENERAL_DOCUMENT_CODES'])
      WHEN 'team_lead'::public.actor_role_code THEN action_definition.code::text = ANY (ARRAY['ADD_MEMBER','ASSIGN_MEMBER'])
      WHEN 'division_member'::public.actor_role_code THEN action_definition.code::text = ANY (ARRAY['MEMBER_REQUEST_INFO','PM_MEMBER_SUBMIT','ORIGIN_MEMBER_APPROVE','ORIGIN_MEMBER_REJECT','ADD_WORK_REQUEST_DOCUMENT','ADD_WORK_REQUEST_NOTE','REQUEST_WORKFLOW_INFO','RESPOND_WORKFLOW_INFO'])
      WHEN 'tms_manager'::public.actor_role_code THEN action_definition.code::text = ANY (ARRAY['ASSIGN_TMS_CHAIN','ENGINEERING_REQUEST_PM_REVISION','TMS_LEAD_RESPOND_TO_MEMBER','ENGINEERING_SUBMIT_TO_MARKETING','ENGINEERING_REQUEST_TMS_REVISION','ADD_WORK_REQUEST_DOCUMENT','ADD_WORK_REQUEST_NOTE','REQUEST_WORKFLOW_INFO','RESPOND_WORKFLOW_INFO'])
      WHEN 'tms_drawing'::public.actor_role_code THEN action_definition.code::text = ANY (ARRAY['SUBMIT_DRAWING','TMS_MEMBER_REQUEST_LEAD','ADD_WORK_REQUEST_DOCUMENT','ADD_WORK_REQUEST_NOTE','REQUEST_WORKFLOW_INFO','RESPOND_WORKFLOW_INFO'])
      WHEN 'tms_checking'::public.actor_role_code THEN action_definition.code::text = ANY (ARRAY['REVIEW_CHECKING_APPROVE','REVIEW_CHECKING_REJECT','TMS_MEMBER_REQUEST_LEAD','ADD_WORK_REQUEST_DOCUMENT','ADD_WORK_REQUEST_NOTE','REQUEST_WORKFLOW_INFO','RESPOND_WORKFLOW_INFO'])
      WHEN 'tms_approval'::public.actor_role_code THEN action_definition.code::text = ANY (ARRAY['REVIEW_APPROVAL_APPROVE','REVIEW_APPROVAL_REJECT','TMS_MEMBER_REQUEST_LEAD','ADD_WORK_REQUEST_DOCUMENT','ADD_WORK_REQUEST_NOTE','REQUEST_WORKFLOW_INFO','RESPOND_WORKFLOW_INFO'])
      WHEN 'client_owner'::public.actor_role_code THEN action_definition.code::text = ANY (ARRAY['ADD_CLIENT_DOCUMENT','REQUEST_WORKFLOW_INFO','RESPOND_WORKFLOW_INFO','CLIENT_PROVIDE_INFO','CLIENT_REQUEST_REVISION','CLIENT_ACCEPT_FINAL','CLIENT_REJECT_FINAL','DECIDE_BID_OUTCOME'])
      ELSE false
    END
  FROM public.system_roles system_role CROSS JOIN public.workflow_action_definitions action_definition;
  INSERT INTO public.document_code_options (tenant_id, id, document_group, code, name, description)
  VALUES
    (v_tenant_id, gen_random_uuid(), 'MARKETING'::public.document_group_code, '000', 'Info', NULL),
    (v_tenant_id, gen_random_uuid(), 'MARKETING'::public.document_group_code, '001', 'Project Information', NULL),
    (v_tenant_id, gen_random_uuid(), 'MARKETING'::public.document_group_code, '002', 'Cargo Information', NULL),
    (v_tenant_id, gen_random_uuid(), 'MARKETING'::public.document_group_code, '011', 'Action Log', NULL),
    (v_tenant_id, gen_random_uuid(), 'MARKETING'::public.document_group_code, '012', 'Contact List', NULL),
    (v_tenant_id, gen_random_uuid(), 'MARKETING'::public.document_group_code, '013', 'Comment Sheet', NULL),
    (v_tenant_id, gen_random_uuid(), 'MARKETING'::public.document_group_code, '802', 'Contract', NULL),
    (v_tenant_id, gen_random_uuid(), 'MARKETING'::public.document_group_code, '803', 'Invoice', NULL)
  ON CONFLICT (tenant_id, document_group, code) DO NOTHING;
  INSERT INTO public.workflow_action_role_permissions (tenant_id, id, action_id, role_id, allowed)
  SELECT v_tenant_id, gen_random_uuid(), action_definition.id, system_role.role_id,
    system_role.system_code IN ('system_admin'::public.actor_role_code, 'division_head'::public.actor_role_code)
  FROM public.system_roles AS system_role
  CROSS JOIN public.workflow_action_definitions AS action_definition
  WHERE action_definition.code = 'MANAGE_DESIGNATIONS'::public.workflow_action_code
  ON CONFLICT (tenant_id, action_id, role_id) DO UPDATE SET allowed = EXCLUDED.allowed;
  IF (SELECT count(*)
      FROM public.workflow_action_role_permissions AS permission_grant
      WHERE permission_grant.tenant_id = v_tenant_id) <> v_role_count * v_action_count THEN
    RAISE EXCEPTION 'Tenant permission matrix initialization was incomplete';
  END IF;
  RETURN QUERY SELECT v_tenant_id, v_company_id, v_user_id, v_user_role_id, v_actor_profile_id;
END;
$function$;

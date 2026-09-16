-- Custom Access Role V1.  This is an expand-and-contract migration:
-- existing role IDs remain unchanged, and system identity moves to the
-- system_roles subtype before the old roles.code column is removed.
--
-- Rollback: before custom roles are created, restore roles.code from
-- system_roles.system_code, restore the four workflow FKs to roles(id), then
-- drop the new policies, triggers, subtype table, custom_role_scope, and fields.

DO $preflight$
BEGIN
  IF EXISTS (SELECT 1 FROM public.roles WHERE code IS NULL OR is_system_role IS DISTINCT FROM true) THEN
    RAISE EXCEPTION 'Custom-role migration requires every existing role to be a system role';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.workflow_transitions wt
    LEFT JOIN public.roles r1 ON r1.id = wt.from_role_id
    LEFT JOIN public.roles r2 ON r2.id = wt.target_role_id
    WHERE (wt.from_role_id IS NOT NULL AND r1.id IS NULL)
       OR (wt.target_role_id IS NOT NULL AND r2.id IS NULL)
  ) THEN
    RAISE EXCEPTION 'Workflow transition role reference preflight failed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.workflow_info_requests wir
    LEFT JOIN public.roles r ON r.id = wir.target_role_id
    WHERE wir.target_role_id IS NOT NULL AND r.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Workflow info request role reference preflight failed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.work_request_revision_requests wrr
    LEFT JOIN public.roles r ON r.id = wrr.requested_to_role_id
    WHERE wrr.requested_to_role_id IS NOT NULL AND r.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Work request revision role reference preflight failed';
  END IF;
END
$preflight$;

CREATE TYPE public.custom_role_scope AS ENUM (
  'member', 'division', 'company', 'client_contact', 'client'
);

ALTER TABLE public.roles
  ADD COLUMN tenant_id uuid,
  ADD COLUMN custom_code varchar(120),
  ADD COLUMN custom_scope public.custom_role_scope;

CREATE TABLE public.system_roles (
  role_id uuid NOT NULL,
  system_code public.actor_role_code NOT NULL,
  CONSTRAINT system_roles_pkey PRIMARY KEY (role_id),
  CONSTRAINT system_roles_system_code_key UNIQUE (system_code),
  CONSTRAINT system_roles_role_id_fkey FOREIGN KEY (role_id)
    REFERENCES public.roles(id) ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO public.system_roles (role_id, system_code)
SELECT id, code FROM public.roles;

ALTER TABLE public.roles
  ADD CONSTRAINT roles_tenant_id_fkey FOREIGN KEY (tenant_id)
    REFERENCES public.tenants(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT roles_system_or_custom_shape CHECK (
    (is_system_role = true AND tenant_id IS NULL AND custom_code IS NULL AND custom_scope IS NULL)
    OR
    (is_system_role = false AND tenant_id IS NOT NULL AND custom_code IS NOT NULL AND custom_scope IS NOT NULL)
  );

CREATE UNIQUE INDEX roles_tenant_id_custom_code_key
  ON public.roles (tenant_id, custom_code);
CREATE INDEX roles_tenant_id_idx ON public.roles (tenant_id);

ALTER TABLE public.workflow_transitions
  DROP CONSTRAINT workflow_transitions_from_role_id_fkey,
  DROP CONSTRAINT workflow_transitions_target_role_id_fkey,
  ADD CONSTRAINT workflow_transitions_from_role_id_fkey FOREIGN KEY (from_role_id)
    REFERENCES public.system_roles(role_id) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT workflow_transitions_target_role_id_fkey FOREIGN KEY (target_role_id)
    REFERENCES public.system_roles(role_id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE public.workflow_info_requests
  DROP CONSTRAINT workflow_info_requests_target_role_id_fkey,
  ADD CONSTRAINT workflow_info_requests_target_role_id_fkey FOREIGN KEY (target_role_id)
    REFERENCES public.system_roles(role_id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE public.work_request_revision_requests
  DROP CONSTRAINT work_request_revision_requests_requested_to_role_id_fkey,
  ADD CONSTRAINT work_request_revision_requests_requested_to_role_id_fkey FOREIGN KEY (requested_to_role_id)
    REFERENCES public.system_roles(role_id) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION public.assert_role_tenant_match()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.roles AS role_definition
    WHERE role_definition.id = NEW.role_id
      AND (role_definition.is_system_role = true OR role_definition.tenant_id = NEW.tenant_id)
  ) THEN
    RAISE EXCEPTION 'Role must be a system role or belong to the same tenant'
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE CONSTRAINT TRIGGER user_roles_role_tenant_match
AFTER INSERT OR UPDATE OF tenant_id, role_id ON public.user_roles
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION public.assert_role_tenant_match();

CREATE CONSTRAINT TRIGGER actor_profiles_role_tenant_match
AFTER INSERT OR UPDATE OF tenant_id, role_id ON public.actor_profiles
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION public.assert_role_tenant_match();

CREATE CONSTRAINT TRIGGER workflow_action_role_permissions_role_tenant_match
AFTER INSERT OR UPDATE OF tenant_id, role_id ON public.workflow_action_role_permissions
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION public.assert_role_tenant_match();

CREATE OR REPLACE FUNCTION public.assert_role_subtype_shape()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NEW.is_system_role = true
     AND NOT EXISTS (SELECT 1 FROM public.system_roles WHERE role_id = NEW.id) THEN
    RAISE EXCEPTION 'System role requires a system_roles identity row'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.is_system_role = false
     AND EXISTS (SELECT 1 FROM public.system_roles WHERE role_id = NEW.id) THEN
    RAISE EXCEPTION 'Custom role cannot have a system_roles identity row'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE CONSTRAINT TRIGGER roles_system_subtype_shape
AFTER INSERT OR UPDATE OF is_system_role ON public.roles
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.assert_role_subtype_shape();

CREATE OR REPLACE FUNCTION public.assert_system_role_identity_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.roles WHERE id = OLD.role_id AND is_system_role = true) THEN
      RAISE EXCEPTION 'A system role identity cannot be removed' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE id = NEW.role_id AND is_system_role = true) THEN
    RAISE EXCEPTION 'system_roles may reference only system roles' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER system_roles_identity_write
BEFORE INSERT OR UPDATE OR DELETE ON public.system_roles
FOR EACH ROW EXECUTE FUNCTION public.assert_system_role_identity_write();

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS roles_visibility_and_custom_tenant_write ON public.roles;
CREATE POLICY roles_visibility_and_custom_tenant_write ON public.roles
  AS PERMISSIVE FOR ALL TO app_user
  USING (
    is_system_role = true
    OR tenant_id = current_setting('app.tenant_id')::uuid
  )
  WITH CHECK (
    is_system_role = false
    AND tenant_id = current_setting('app.tenant_id')::uuid
  );

ALTER TABLE public.system_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY system_roles_catalog_read ON public.system_roles
  AS PERMISSIVE FOR SELECT TO app_user
  USING (true);

GRANT INSERT, UPDATE ON TABLE public.roles TO app_user;
GRANT SELECT ON TABLE public.system_roles TO app_user;

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
      WHEN 'division_head'::public.actor_role_code THEN action_definition.code::text = ANY (ARRAY['ADD_DIVISION','ADD_TEAM','ASSIGN_LEADER'])
      WHEN 'division_lead'::public.actor_role_code THEN action_definition.code::text = ANY (ARRAY['ADD_TEAM','REQUEST_INFO_FROM_MARKETING','PM_LEAD_RESPOND_TO_MEMBER','PM_RETURN_TO_MEMBER','ASSIGN_MEMBER','FORWARD_TO_TMS','ORIGIN_MANAGER_APPROVE','FORWARD_TO_CCR','ADD_WORK_REQUEST_DOCUMENT','ADD_WORK_REQUEST_NOTE','REQUEST_WORKFLOW_INFO','RESPOND_WORKFLOW_INFO'])
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
  IF (SELECT count(*) FROM public.workflow_action_role_permissions WHERE tenant_id = v_tenant_id) <> v_role_count * v_action_count THEN
    RAISE EXCEPTION 'Tenant permission matrix initialization was incomplete';
  END IF;
  RETURN QUERY SELECT v_tenant_id, v_company_id, v_user_id, v_user_role_id, v_actor_profile_id;
END;
$function$;

ALTER TABLE public.roles DROP COLUMN code;

REVOKE ALL ON FUNCTION public.provision_company_workspace_core(text, text, uuid, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.provision_company_workspace_core(text, text, uuid, text, text, text, text, text) FROM app_user;

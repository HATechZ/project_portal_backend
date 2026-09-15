-- Workspace-aware universal sign in.
-- Rollback: within the deployment transaction, any failure rolls back automatically. After
-- deployment, revoke/drop resolve_company_workspace and the public provisioning wrapper,
-- rename provision_company_workspace_core back, drop the Company slug trigger/function,
-- then drop companies_workspace_slug_key and companies.workspace_slug only after confirming
-- no client depends on workspace URLs returned after this migration.

ALTER TABLE public.companies
  ADD COLUMN workspace_slug VARCHAR(100);

CREATE FUNCTION public.set_company_workspace_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
DECLARE
  v_base text;
  v_candidate text;
  v_attempt integer := 0;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.workspace_slug IS DISTINCT FROM OLD.workspace_slug THEN
      RAISE EXCEPTION 'workspace_slug is immutable after Company creation'
        USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.workspace_slug IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_base := trim(BOTH '-' FROM left(
    regexp_replace(lower(btrim(NEW.name)), '[^a-z0-9]+', '-', 'g'),
    100
  ));
  IF v_base = '' THEN
    v_base := 'company';
  END IF;

  -- Serialize candidate selection for identical normalized names. The lock is scoped to
  -- this transaction and does not grant or require access to any application relation.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_base, 0));
  v_candidate := v_base;

  WHILE EXISTS (
    SELECT 1 FROM public.companies AS company
    WHERE company.workspace_slug = v_candidate
  ) LOOP
    v_attempt := v_attempt + 1;
    v_candidate := left(v_base, 58) || '-' ||
      replace(NEW.id::text, '-', '') || '-' || v_attempt::text;
  END LOOP;

  NEW.workspace_slug := v_candidate;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_company_workspace_slug() FROM PUBLIC;

DO $backfill$
DECLARE
  company_record record;
  v_base text;
  v_candidate text;
  v_attempt integer;
BEGIN
  FOR company_record IN
    SELECT company.id, company.name
    FROM public.companies AS company
    ORDER BY company.id
  LOOP
    v_base := trim(BOTH '-' FROM left(
      regexp_replace(lower(btrim(company_record.name)), '[^a-z0-9]+', '-', 'g'),
      100
    ));
    IF v_base = '' THEN
      v_base := 'company';
    END IF;
    v_candidate := v_base;
    v_attempt := 0;

    WHILE EXISTS (
      SELECT 1 FROM public.companies AS existing_company
      WHERE existing_company.workspace_slug = v_candidate
    ) LOOP
      v_attempt := v_attempt + 1;
      v_candidate := left(v_base, 58) || '-' ||
        replace(company_record.id::text, '-', '') || '-' || v_attempt::text;
    END LOOP;

    UPDATE public.companies
    SET workspace_slug = v_candidate
    WHERE id = company_record.id;
  END LOOP;
END;
$backfill$;

ALTER TABLE public.companies
  ALTER COLUMN workspace_slug SET NOT NULL;

ALTER TABLE public.companies
  ADD CONSTRAINT companies_workspace_slug_format_check
  CHECK (workspace_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

CREATE UNIQUE INDEX companies_workspace_slug_key
  ON public.companies (workspace_slug);

CREATE TRIGGER companies_generate_workspace_slug
BEFORE INSERT OR UPDATE OF workspace_slug ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.set_company_workspace_slug();

ALTER FUNCTION public.provision_company_workspace(text, text, uuid, text, text, text, text, text)
  RENAME TO provision_company_workspace_core;

REVOKE ALL ON FUNCTION public.provision_company_workspace_core(text, text, uuid, text, text, text, text, text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.provision_company_workspace_core(text, text, uuid, text, text, text, text, text)
  FROM app_user;

CREATE FUNCTION public.provision_company_workspace(
  p_company_name text,
  p_company_abbr text,
  p_company_type_id uuid,
  p_admin_full_name text,
  p_admin_email text,
  p_admin_password_hash text,
  p_admin_country text,
  p_admin_phone text
)
RETURNS TABLE (
  tenant_id uuid,
  company_id uuid,
  workspace_slug text,
  user_id uuid,
  user_role_id uuid,
  actor_profile_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_tenant_id uuid;
  v_company_id uuid;
  v_user_id uuid;
  v_user_role_id uuid;
  v_actor_profile_id uuid;
  v_workspace_slug text;
BEGIN
  SELECT provisioned.tenant_id,
         provisioned.company_id,
         provisioned.user_id,
         provisioned.user_role_id,
         provisioned.actor_profile_id
  INTO v_tenant_id,
       v_company_id,
       v_user_id,
       v_user_role_id,
       v_actor_profile_id
  FROM public.provision_company_workspace_core(
    p_company_name,
    p_company_abbr,
    p_company_type_id,
    p_admin_full_name,
    p_admin_email,
    p_admin_password_hash,
    p_admin_country,
    p_admin_phone
  ) AS provisioned;

  SELECT company.workspace_slug
  INTO STRICT v_workspace_slug
  FROM public.companies AS company
  WHERE company.id = v_company_id;

  RETURN QUERY
  SELECT v_tenant_id,
         v_company_id,
         v_workspace_slug,
         v_user_id,
         v_user_role_id,
         v_actor_profile_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.provision_company_workspace(text, text, uuid, text, text, text, text, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_company_workspace(text, text, uuid, text, text, text, text, text)
  TO app_user;

CREATE FUNCTION public.resolve_company_workspace(p_workspace_slug text)
RETURNS TABLE (tenant_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT company.tenant_id
  FROM public.companies AS company
  JOIN public.tenants AS tenant ON tenant.id = company.tenant_id
  WHERE company.workspace_slug = lower(btrim(p_workspace_slug))
    AND company.is_active = true
    AND tenant.is_active = true
$function$;

REVOKE ALL ON FUNCTION public.resolve_company_workspace(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_company_workspace(text) TO app_user;

-- Global normalized-email identity for universal email/password sign in.
-- Rollback: revoke/drop resolve_user_login_email, recreate resolve_company_workspace from
-- migration 20260903010000, drop users_email_canonical_check and the users_email_key
-- constraint, then recreate the users_tenant_id_email_key unique index on (tenant_id, email).
-- Rolling back re-enables duplicate emails across
-- tenants and therefore requires restoring workspaceSlug to the public login contract.

BEGIN;

-- Fail closed if any environment contains data that cannot satisfy the approved identity
-- rule. This migration never guesses, merges, or repairs User identities.
DO $preflight$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.users AS app_user_record
    WHERE btrim(app_user_record.email) = ''
  ) THEN
    RAISE EXCEPTION 'Global normalized-email migration blocked: blank User email exists';
  END IF;

  IF EXISTS (
    SELECT lower(btrim(app_user_record.email))
    FROM public.users AS app_user_record
    GROUP BY lower(btrim(app_user_record.email))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Global normalized-email migration blocked: duplicate normalized User email exists';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.users AS app_user_record
    WHERE app_user_record.email <> lower(btrim(app_user_record.email))
  ) THEN
    RAISE EXCEPTION 'Global normalized-email migration blocked: non-canonical User email exists';
  END IF;
END;
$preflight$;

DROP INDEX public.users_tenant_id_email_key;

ALTER TABLE public.users
  ADD CONSTRAINT users_email_canonical_check
  CHECK (email = lower(btrim(email)) AND email <> '');

ALTER TABLE public.users
  ADD CONSTRAINT users_email_key UNIQUE (email);

-- workspaceSlug remains Company-owned and globally unique, but is no longer a login
-- credential. Remove only the obsolete pre-auth workspace resolver capability.
REVOKE ALL ON FUNCTION public.resolve_company_workspace(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_company_workspace(text) FROM app_user;
DROP FUNCTION public.resolve_company_workspace(text);

CREATE FUNCTION public.resolve_user_login_email(p_email text)
RETURNS TABLE (tenant_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT app_user_record.tenant_id
  FROM public.users AS app_user_record
  JOIN public.tenants AS tenant
    ON tenant.id = app_user_record.tenant_id
  WHERE app_user_record.email = lower(btrim(p_email))
    AND app_user_record.is_active = true
    AND tenant.is_active = true
$function$;

REVOKE ALL ON FUNCTION public.resolve_user_login_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_user_login_email(text) TO app_user;

COMMIT;

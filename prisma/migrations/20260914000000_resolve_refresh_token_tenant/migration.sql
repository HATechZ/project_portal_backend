-- Resolve only the Tenant owning a refresh-token hash before tenant-scoped rotation.
-- The function does not authorize refresh; the normal RLS-protected rotation still checks
-- expiry, revocation, and replay state after RequestContext is established.

CREATE FUNCTION public.resolve_refresh_token_tenant(p_refresh_token_hash text)
RETURNS TABLE (tenant_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT matched.tenant_id
  FROM (
    SELECT session.tenant_id
    FROM public.auth_sessions AS session
    WHERE session.refresh_token_hash = p_refresh_token_hash
       OR session.previous_refresh_token_hash = p_refresh_token_hash

    UNION

    SELECT session.tenant_id
    FROM public.auth_session_consumed_refresh_tokens AS consumed
    JOIN public.auth_sessions AS session
      ON session.id = consumed.session_id
    WHERE consumed.token_hash = p_refresh_token_hash
  ) AS matched
  LIMIT 1
$function$;

REVOKE ALL ON FUNCTION public.resolve_refresh_token_tenant(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_refresh_token_tenant(text) FROM app_relay;
GRANT EXECUTE ON FUNCTION public.resolve_refresh_token_tenant(text) TO app_user;

-- Align UserRole's legacy Team-binding trigger with the approved role-grant API.
--
-- Team responsibility is derived from the ActorProfile and request resource.  The
-- API deliberately accepts no team_id for a Team-scoped custom role, so an active
-- Team-scoped grant may now have team_id NULL.  The nullable column, its
-- tenant-qualified FK, index, RLS, and existing data are intentionally retained.
--
-- Historical bindings remain valid.  A non-Team role may retain a non-NULL team_id
-- only after revocation; an active grant may not be created or reactivated with
-- that incompatible binding.

CREATE OR REPLACE FUNCTION public.assert_user_role_team_scope_shape()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
DECLARE
  v_is_system_role boolean;
  v_custom_scope public.custom_role_scope;
BEGIN
  SELECT role_definition.is_system_role, role_definition.custom_scope
    INTO v_is_system_role, v_custom_scope
  FROM public.roles AS role_definition
  WHERE role_definition.id = NEW.role_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User role must reference an existing role'
      USING ERRCODE = '23503';
  END IF;

  IF NEW.revoked_at IS NULL
     AND NEW.team_id IS NOT NULL
     AND (
       v_is_system_role = true
       OR v_custom_scope IS DISTINCT FROM 'team'::public.custom_role_scope
     ) THEN
    RAISE EXCEPTION 'Only active team-scoped custom role grants may have team_id'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

-- Include revoked_at so an incompatible legacy row cannot be reactivated without
-- passing the active-binding check above.
DROP TRIGGER IF EXISTS user_roles_team_scope_shape ON public.user_roles;

CREATE CONSTRAINT TRIGGER user_roles_team_scope_shape
AFTER INSERT OR UPDATE OF tenant_id, role_id, team_id, revoked_at ON public.user_roles
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION public.assert_user_role_team_scope_shape();

CREATE OR REPLACE FUNCTION public.assert_role_user_role_team_scope_shape()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.user_roles AS user_role
    WHERE user_role.role_id = NEW.id
      AND user_role.revoked_at IS NULL
      AND user_role.team_id IS NOT NULL
      AND (
        NEW.is_system_role = true
        OR NEW.custom_scope IS DISTINCT FROM 'team'::public.custom_role_scope
      )
  ) THEN
    RAISE EXCEPTION 'Role scope is incompatible with existing active user-role team bindings'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

-- Rollback preflight: restoring the 20260928000100 trigger definitions is safe
-- only if this query returns no rows.  Do not delete or rewrite historical grants
-- to make a rollback pass.
--
-- SELECT ur.id
-- FROM public.user_roles AS ur
-- JOIN public.roles AS r ON r.id = ur.role_id
-- WHERE (r.is_system_role = false
--        AND r.custom_scope = 'team'::public.custom_role_scope
--        AND ur.team_id IS NULL)
--    OR ((r.is_system_role = true
--         OR r.custom_scope IS DISTINCT FROM 'team'::public.custom_role_scope)
--        AND ur.team_id IS NOT NULL);
--
-- After a successful preflight, restore the two function definitions and the
-- user_roles_team_scope_shape trigger definition from
-- 20260928000100_add_user_role_team_scope_binding (without revoked_at in its
-- UPDATE OF column list).

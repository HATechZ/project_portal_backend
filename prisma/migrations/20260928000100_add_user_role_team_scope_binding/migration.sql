-- Bind team-scoped custom-role grants to one explicit tenant-local Team.
--
-- Rollback: drop user_roles_team_scope_shape, drop
-- public.assert_user_role_team_scope_shape(), drop
-- roles_user_role_team_scope_shape, drop
-- public.assert_role_user_role_team_scope_shape(), drop
-- user_roles_tenant_id_team_id_revoked_at_idx, drop
-- user_roles_team_id_tenant_id_fkey, then drop user_roles.team_id.

ALTER TABLE public.user_roles
  ADD COLUMN team_id uuid;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_team_id_tenant_id_fkey
  FOREIGN KEY (team_id, tenant_id)
  REFERENCES public.teams (id, tenant_id)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

CREATE INDEX user_roles_tenant_id_team_id_revoked_at_idx
  ON public.user_roles (tenant_id, team_id, revoked_at);

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

  IF v_is_system_role = false
     AND v_custom_scope = 'team'::public.custom_role_scope THEN
    IF NEW.team_id IS NULL THEN
      RAISE EXCEPTION 'Team-scoped custom role grants require team_id'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.team_id IS NOT NULL THEN
    RAISE EXCEPTION 'Only team-scoped custom role grants may have team_id'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE CONSTRAINT TRIGGER user_roles_team_scope_shape
AFTER INSERT OR UPDATE OF tenant_id, role_id, team_id ON public.user_roles
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
      AND (
        (NEW.is_system_role = false
          AND NEW.custom_scope = 'team'::public.custom_role_scope
          AND user_role.team_id IS NULL)
        OR
        ((NEW.is_system_role = true
          OR NEW.custom_scope IS DISTINCT FROM 'team'::public.custom_role_scope)
          AND user_role.team_id IS NOT NULL)
      )
  ) THEN
    RAISE EXCEPTION 'Role scope is incompatible with existing user-role team bindings'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE CONSTRAINT TRIGGER roles_user_role_team_scope_shape
AFTER UPDATE OF is_system_role, custom_scope ON public.roles
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION public.assert_role_user_role_team_scope_shape();

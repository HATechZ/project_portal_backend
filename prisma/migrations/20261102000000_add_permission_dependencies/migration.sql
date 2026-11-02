-- Global permission-catalogue dependency edges. Permissions are themselves
-- global, so this relation deliberately has no tenant_id and no tenant RLS
-- policy. Catalogue writes remain migration/owner controlled; app_user gets
-- only the read privilege required to resolve role-selection metadata.
--
-- Rollback: DROP TABLE public.permission_dependencies; this removes only
-- dependency metadata. Perform it only after role validation/API code no
-- longer reads the relation.

CREATE TABLE "permission_dependencies" (
    "permission_id" UUID NOT NULL,
    "required_permission_id" UUID NOT NULL,

    CONSTRAINT "permission_dependencies_pkey"
      PRIMARY KEY ("permission_id", "required_permission_id"),
    CONSTRAINT "permission_dependencies_not_self"
      CHECK ("permission_id" <> "required_permission_id")
);

CREATE INDEX "permission_dependencies_required_permission_id_idx"
  ON "permission_dependencies"("required_permission_id");

ALTER TABLE "permission_dependencies"
  ADD CONSTRAINT "permission_dependencies_permission_id_fkey"
  FOREIGN KEY ("permission_id") REFERENCES "permissions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- The catalogue is migration/owner controlled, but reject a bad future edge
-- at the database boundary as well as in role-validation reads.
CREATE FUNCTION public.reject_permission_dependency_cycle()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF EXISTS (
    WITH RECURSIVE reachable(permission_id) AS (
      SELECT NEW.required_permission_id
      UNION
      SELECT dependency.required_permission_id
      FROM public.permission_dependencies AS dependency
      JOIN reachable ON dependency.permission_id = reachable.permission_id
    )
    SELECT 1 FROM reachable WHERE permission_id = NEW.permission_id
  ) THEN
    RAISE EXCEPTION 'permission dependency would create a cycle'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER permission_dependencies_reject_cycle
BEFORE INSERT OR UPDATE ON public.permission_dependencies
FOR EACH ROW EXECUTE FUNCTION public.reject_permission_dependency_cycle();

ALTER TABLE "permission_dependencies"
  ADD CONSTRAINT "permission_dependencies_required_permission_id_fkey"
  FOREIGN KEY ("required_permission_id") REFERENCES "permissions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

GRANT SELECT ON TABLE public.permission_dependencies TO app_user;

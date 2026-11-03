-- Bootstrap the one global tenant_super_admin identity before the immediately
-- following Work Request grant migration consumes it.  This bridge is
-- deliberately ordered after the in-place enum rename and before
-- 20260929000001.  It leaves applied migration files untouched, so already
-- migrated databases receive an idempotent no-op when their canonical identity
-- already exists.
--
-- The fixed UUID is the canonical seed identity.  The predicate on
-- system_roles (rather than roles) prevents a second Role row when an existing
-- environment has already provisioned the renamed system role.
--
-- Rollback: only on a database created by this bridge and before any tenant
-- references exist, remove the system_roles row and its Role row together.

INSERT INTO public.roles (id, name, description, is_system_role)
SELECT
  '10000000-0000-4000-8000-000000000001'::uuid,
  'Tenant Super Administrator',
  'Highest administrator for this tenant/company; access remains permission and scope driven.',
  true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.system_roles
  WHERE system_code = 'tenant_super_admin'::public.actor_role_code
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.system_roles (role_id, system_code)
SELECT
  '10000000-0000-4000-8000-000000000001'::uuid,
  'tenant_super_admin'::public.actor_role_code
WHERE NOT EXISTS (
  SELECT 1
  FROM public.system_roles
  WHERE system_code = 'tenant_super_admin'::public.actor_role_code
)
ON CONFLICT (system_code) DO NOTHING;

DO $migration$
BEGIN
  IF (
    SELECT count(*)
    FROM public.system_roles
    WHERE system_code = 'tenant_super_admin'::public.actor_role_code
  ) <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one tenant_super_admin system role after bootstrap';
  END IF;
END;
$migration$;

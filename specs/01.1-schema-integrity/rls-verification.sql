-- Execute later with psql after the Phase 6 migration has been applied.
-- This script is read-only and requires an existing outbox row owned by tenant_a.
-- Example:
--   psql "$DATABASE_URL_MIGRATION" \
--     -v tenant_a=00000000-0000-4000-8000-000000000001 \
--     -v tenant_b=00000000-0000-4000-8000-000000000002 \
--     -v outbox_a=00000000-0000-4000-8000-000000000003 \
--     -f specs/01.1-schema-integrity/rls-verification.sql

\set ON_ERROR_STOP on

BEGIN;

SET LOCAL ROLE app_user;

DO $$
BEGIN
  BEGIN
    PERFORM count(*) FROM outbox_messages;
    RAISE EXCEPTION 'missing app.tenant_id did not fail closed';
  EXCEPTION
    WHEN undefined_object THEN NULL;
  END;
END
$$;

SELECT set_config('test.expected_outbox_id', :'outbox_a', true);
SELECT set_config('test.tenant_a', :'tenant_a', true);
SELECT set_config('test.tenant_b', :'tenant_b', true);
SELECT set_config('app.tenant_id', :'tenant_a', true);

DO $$
BEGIN
  IF (SELECT count(*) FROM tenants) <> 1 OR
     (SELECT count(*) FROM tenants
      WHERE id = current_setting('app.tenant_id')::uuid) <> 1 THEN
    RAISE EXCEPTION 'app_user tenant-root policy did not expose exactly tenant_a';
  END IF;

  IF (SELECT count(*) FROM outbox_messages
      WHERE id = current_setting('test.expected_outbox_id')::uuid) <> 1 THEN
    RAISE EXCEPTION 'app_user did not see the expected row for tenant_a';
  END IF;

  BEGIN
    INSERT INTO outbox_messages (
      tenant_id,
      id,
      event_type,
      routing_key,
      payload
    ) VALUES (
      current_setting('test.tenant_b')::uuid,
      '00000000-0000-4000-8000-000000000006'::uuid,
      'rls.verification.denied',
      'rls.verification.denied',
      '{}'::jsonb
    );
    RAISE EXCEPTION 'app_user cross-tenant INSERT unexpectedly succeeded';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END
$$;

SELECT set_config('app.tenant_id', :'tenant_b', true);

DO $$
BEGIN
  IF (SELECT count(*) FROM tenants) <> 1 OR
     (SELECT count(*) FROM tenants
      WHERE id = current_setting('app.tenant_id')::uuid) <> 1 THEN
    RAISE EXCEPTION 'app_user tenant-root policy did not expose exactly tenant_b';
  END IF;

  IF (SELECT count(*) FROM tenants
      WHERE id = current_setting('test.tenant_a')::uuid) <> 0 THEN
    RAISE EXCEPTION 'tenant_a registry row leaked while scoped to tenant_b';
  END IF;

  IF (SELECT count(*) FROM outbox_messages
      WHERE id = current_setting('test.expected_outbox_id')::uuid) <> 0 THEN
    RAISE EXCEPTION 'app_user saw tenant_a row while scoped to tenant_b';
  END IF;

  BEGIN
    UPDATE outbox_messages
    SET attempts = attempts + 1
    WHERE id = current_setting('test.expected_outbox_id')::uuid;
    RAISE EXCEPTION 'app_user cross-tenant UPDATE unexpectedly succeeded';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END
$$;

RESET ROLE;
SET LOCAL ROLE app_relay;

DO $$
BEGIN
  IF (SELECT count(*) FROM outbox_messages
      WHERE id = current_setting('test.expected_outbox_id')::uuid) <> 1 THEN
    RAISE EXCEPTION 'app_relay did not bypass RLS for the expected cross-tenant row';
  END IF;
END
$$;

RESET ROLE;

DO $$
BEGIN

  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'app_user'
      AND rolcanlogin
      AND NOT rolsuper
      AND NOT rolcreaterole
      AND NOT rolbypassrls
  ) THEN
    RAISE EXCEPTION 'app_user runtime identity attributes are unsafe';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'app_relay'
      AND rolcanlogin
      AND NOT rolsuper
      AND NOT rolcreaterole
      AND rolbypassrls
  ) THEN
    RAISE EXCEPTION 'app_relay runtime identity attributes are unsafe';
  END IF;

  IF pg_has_role('app_user', 'app_relay', 'MEMBER') THEN
    RAISE EXCEPTION 'app_user can SET ROLE app_relay through role membership';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class AS table_definition
    JOIN pg_namespace AS table_schema
      ON table_schema.oid = table_definition.relnamespace
    JOIN pg_roles AS table_owner
      ON table_owner.oid = table_definition.relowner
    WHERE table_schema.nspname = 'public'
      AND table_definition.relkind = 'r'
      AND table_owner.rolname IN ('app_user', 'app_relay')
  ) THEN
    RAISE EXCEPTION 'a runtime role owns a public table and therefore bypasses RLS';
  END IF;

  IF NOT has_table_privilege('app_relay', 'public.outbox_messages', 'SELECT') OR
     NOT has_table_privilege('app_relay', 'public.outbox_messages', 'UPDATE') OR
     has_table_privilege('app_relay', 'public.outbox_messages', 'INSERT') OR
     has_table_privilege('app_relay', 'public.outbox_messages', 'DELETE') THEN
    RAISE EXCEPTION 'app_relay outbox privileges are not exactly SELECT and UPDATE';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class AS table_definition
    JOIN pg_namespace AS table_schema
      ON table_schema.oid = table_definition.relnamespace
    WHERE table_schema.nspname = 'public'
      AND table_definition.relkind = 'r'
      AND table_definition.relname <> 'outbox_messages'
      AND (
        has_table_privilege('app_relay', table_definition.oid, 'SELECT') OR
        has_table_privilege('app_relay', table_definition.oid, 'INSERT') OR
        has_table_privilege('app_relay', table_definition.oid, 'UPDATE') OR
        has_table_privilege('app_relay', table_definition.oid, 'DELETE') OR
        has_table_privilege('app_relay', table_definition.oid, 'TRUNCATE') OR
        has_table_privilege('app_relay', table_definition.oid, 'REFERENCES') OR
        has_table_privilege('app_relay', table_definition.oid, 'TRIGGER')
      )
  ) THEN
    RAISE EXCEPTION 'app_relay has table privileges outside outbox_messages';
  END IF;
END
$$;

ROLLBACK;

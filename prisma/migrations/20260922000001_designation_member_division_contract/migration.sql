-- Designation master data, Member designation conversion, Division normalized-name
-- uniqueness, and MANAGE_DESIGNATIONS provisioning.
--
-- This migration is deliberately fail-fast: blank legacy member.role_title values
-- and existing normalized Division collisions abort the transaction before any
-- destructive contract step. It never invents placeholder Designations.
--
-- Rollback note: restore members.role_title from an independently retained backup
-- before dropping designation_id; only drop Designations after confirming there
-- are no Member references. Drop the two normalized unique indexes, RLS policy,
-- grants, permission rows/definition, and then the table in reverse dependency
-- order. PostgreSQL enum rollback is documented in the preceding migration.

CREATE TABLE public.designations (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  company_id uuid NOT NULL,
  name varchar(140) NOT NULL,
  created_at timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT designations_pkey PRIMARY KEY (id),
  CONSTRAINT designations_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT,
  CONSTRAINT designations_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT,
  CONSTRAINT designations_id_tenant_id_company_id_key UNIQUE (id, tenant_id, company_id)
);

CREATE INDEX designations_tenant_id_idx ON public.designations (tenant_id);
CREATE INDEX designations_company_id_idx ON public.designations (company_id);
CREATE UNIQUE INDEX designations_tenant_company_normalized_name_unique
  ON public.designations (tenant_id, company_id, lower(btrim(name)));

ALTER TABLE public.designations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_designations ON public.designations
  AS PERMISSIVE FOR ALL TO app_user
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.designations TO app_user;

-- Expand Member first. Its final NOT NULL relation is installed only after the
-- legacy free-text values have been verified and converted.
ALTER TABLE public.members ADD COLUMN designation_id uuid;

DO $$
DECLARE
  v_invalid_count bigint;
  v_example text;
BEGIN
  SELECT count(*), min(format('tenant=%s company=%s member=%s', tenant_id, company_id, id))
  INTO v_invalid_count, v_example
  FROM public.members
  WHERE role_title IS NULL OR btrim(role_title) = '';

  IF v_invalid_count > 0 THEN
    RAISE EXCEPTION
      'Cannot migrate Member role_title: % blank or null legacy value(s); first %',
      v_invalid_count, v_example
      USING ERRCODE = '23514',
            HINT = 'Repair every listed Member role_title before re-running this migration; no placeholder Designation is created.';
  END IF;
END $$;

-- Select the earliest existing spelling in each tenant/company/normalized-name
-- group, so case and whitespace variants become one Designation deterministically.
WITH legacy_designations AS (
  SELECT DISTINCT ON (m.tenant_id, m.company_id, lower(btrim(m.role_title)))
    m.tenant_id,
    m.company_id,
    btrim(m.role_title) AS name
  FROM public.members AS m
  ORDER BY m.tenant_id, m.company_id, lower(btrim(m.role_title)), m.created_at, m.id
)
INSERT INTO public.designations (tenant_id, id, company_id, name)
SELECT tenant_id, gen_random_uuid(), company_id, name
FROM legacy_designations
ON CONFLICT (tenant_id, company_id, lower(btrim(name))) DO NOTHING;

UPDATE public.members AS m
SET designation_id = d.id
FROM public.designations AS d
WHERE d.tenant_id = m.tenant_id
  AND d.company_id = m.company_id
  AND lower(btrim(d.name)) = lower(btrim(m.role_title))
  AND m.designation_id IS NULL;

DO $$
DECLARE
  v_unmapped_count bigint;
  v_example text;
BEGIN
  SELECT count(*), min(format('tenant=%s company=%s member=%s', m.tenant_id, m.company_id, m.id))
  INTO v_unmapped_count, v_example
  FROM public.members AS m
  LEFT JOIN public.designations AS d
    ON d.id = m.designation_id
   AND d.tenant_id = m.tenant_id
   AND d.company_id = m.company_id
  WHERE m.designation_id IS NULL OR d.id IS NULL;

  IF v_unmapped_count > 0 THEN
    RAISE EXCEPTION
      'Cannot finalize Member designation migration: % Member(s) remain unmapped; first %',
      v_unmapped_count, v_example
      USING ERRCODE = '23514',
            HINT = 'Correct the reported legacy data and re-run; no Member data was discarded.';
  END IF;
END $$;

ALTER TABLE public.members
  ALTER COLUMN designation_id SET NOT NULL,
  ADD CONSTRAINT members_designation_id_tenant_id_company_id_fkey
    FOREIGN KEY (designation_id, tenant_id, company_id)
    REFERENCES public.designations (id, tenant_id, company_id)
    ON DELETE RESTRICT;
CREATE INDEX members_designation_id_tenant_id_company_id_idx
  ON public.members (designation_id, tenant_id, company_id);
ALTER TABLE public.members DROP COLUMN role_title;

-- Existing normalized Division duplicates must be resolved explicitly by the
-- owner; this migration never merges, deletes, or renames Division records.
DO $$
DECLARE
  v_duplicate_count bigint;
  v_example text;
BEGIN
  SELECT count(*), min(format('tenant=%s company=%s name=%s count=%s', tenant_id, company_id, normalized_name, duplicate_count))
  INTO v_duplicate_count, v_example
  FROM (
    SELECT tenant_id, company_id, lower(btrim(name)) AS normalized_name, count(*) AS duplicate_count
    FROM public.divisions
    GROUP BY tenant_id, company_id, lower(btrim(name))
    HAVING count(*) > 1
  ) AS duplicates;

  IF v_duplicate_count > 0 THEN
    RAISE EXCEPTION
      'Cannot add Division normalized-name uniqueness: % conflicting scope(s); first %',
      v_duplicate_count, v_example
      USING ERRCODE = '23505',
            HINT = 'Resolve the reported normalized duplicates manually; this migration does not alter existing Divisions.';
  END IF;
END $$;

CREATE UNIQUE INDEX divisions_tenant_company_normalized_name_unique
  ON public.divisions (tenant_id, company_id, lower(btrim(name)));

INSERT INTO public.workflow_action_definitions (
  id, code, name, description, is_user_visible, is_revision_action,
  is_info_request_action, is_assignment_action, is_terminal_action
)
VALUES (
  gen_random_uuid(),
  'MANAGE_DESIGNATIONS'::public.workflow_action_code,
  'Manage Designations',
  'Allows management of internal member designations.',
  true, false, false, false, false
)
ON CONFLICT (code) DO NOTHING;

-- Existing tenants receive exactly the approved system-role grants. Custom roles
-- are excluded because this selects only public.system_roles.
INSERT INTO public.workflow_action_role_permissions (
  tenant_id, id, action_id, role_id, allowed
)
SELECT
  tenant.id,
  gen_random_uuid(),
  action_definition.id,
  system_role.role_id,
  system_role.system_code IN (
    'system_admin'::public.actor_role_code,
    'division_head'::public.actor_role_code
  )
FROM public.tenants AS tenant
CROSS JOIN public.system_roles AS system_role
CROSS JOIN public.workflow_action_definitions AS action_definition
WHERE action_definition.code = 'MANAGE_DESIGNATIONS'::public.workflow_action_code
ON CONFLICT (tenant_id, action_id, role_id)
DO UPDATE SET allowed = EXCLUDED.allowed;

-- New-tenant provisioning remains centralized in the current authoritative
-- function. Inject the approved action grant immediately before its permission
-- matrix completeness check, preserving all existing action decisions.
DO $$
DECLARE
  v_definition text;
  v_anchor text := '  IF (SELECT count(*)';
  v_insertion text := $sql$
  INSERT INTO public.workflow_action_role_permissions (tenant_id, id, action_id, role_id, allowed)
  SELECT v_tenant_id, gen_random_uuid(), action_definition.id, system_role.role_id,
    system_role.system_code IN ('system_admin'::public.actor_role_code, 'division_head'::public.actor_role_code)
  FROM public.system_roles AS system_role
  CROSS JOIN public.workflow_action_definitions AS action_definition
  WHERE action_definition.code = 'MANAGE_DESIGNATIONS'::public.workflow_action_code
  ON CONFLICT (tenant_id, action_id, role_id) DO UPDATE SET allowed = EXCLUDED.allowed;
$sql$;
BEGIN
  SELECT pg_get_functiondef(
    'public.provision_company_workspace_core(text,text,uuid,text,text,text,text,text)'::regprocedure
  ) INTO v_definition;

  IF position('MANAGE_DESIGNATIONS' IN v_definition) > 0 THEN
    RETURN;
  END IF;

  IF position(v_anchor IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Cannot update tenant provisioning: expected permission-matrix anchor was not found'
      USING ERRCODE = '55000';
  END IF;

  v_definition := replace(v_definition, v_anchor, v_insertion || E'\n' || v_anchor);
  EXECUTE v_definition;
END $$;

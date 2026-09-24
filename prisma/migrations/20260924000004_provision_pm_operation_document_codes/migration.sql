-- Provision the PM & Operation starter catalogue through the shared document-code
-- persistence. These are ordinary starter records, not numeric validation ranges
-- or a closed catalogue.
--
-- Rollback: remove only PM & Operation rows confirmed unreferenced, then restore
-- the preceding provisioning function. Do not delete/recreate referenced rows
-- because documents retain document_code_id foreign keys.

INSERT INTO public.document_code_options (
  tenant_id, id, document_group, code, name, description, sort_order, is_active
)
SELECT
  tenant.id,
  gen_random_uuid(),
  'PROJECT_MANAGEMENT_OPERATION'::public.document_group_code,
  catalogue.code,
  catalogue.name,
  NULL,
  catalogue.sort_order,
  true
FROM public.tenants AS tenant
CROSS JOIN (
  VALUES
    ('601', 'Method Statement', 1),
    ('602', 'Voyage & Weather Routing Plan', 2),
    ('603', 'HSEQ Management Plan', 3),
    ('604', 'Safe Working Plan', 4),
    ('605', 'Emergency Response Plan', 5),
    ('606', 'Anti-Piracy Plan', 6),
    ('607', 'Crew Management Plan', 7),
    ('608', 'Vessel Maintenance Plan', 8)
) AS catalogue(code, name, sort_order)
ON CONFLICT (tenant_id, document_group, code) DO NOTHING;

-- Append PM & Operation rows to the company-provisioning catalogue. The
-- definition is taken from the immediately preceding migration state,
-- preserving unrelated provisioning, grants, and RLS/security behavior.
DO $migration$
DECLARE
  v_definition text;
  v_old_catalogue_tail text := $old$
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '400', 'Voyage Route Analysis', NULL, 23),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '410', 'Summary of Motion Analysis Report', NULL, 24),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '411', 'Speed vs Acceleration', NULL, 25),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '412', 'Static Applied Wind Pressure Trim Calculation', NULL, 26),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '420', 'RAO', NULL, 27),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '430', 'Critical Motion Curve', NULL, 28),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '440', 'Green Water Analysis', NULL, 29)
  ON CONFLICT DO NOTHING;$old$;
  v_new_catalogue_tail text := $new$
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '400', 'Voyage Route Analysis', NULL, 23),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '410', 'Summary of Motion Analysis Report', NULL, 24),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '411', 'Speed vs Acceleration', NULL, 25),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '412', 'Static Applied Wind Pressure Trim Calculation', NULL, 26),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '420', 'RAO', NULL, 27),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '430', 'Critical Motion Curve', NULL, 28),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '440', 'Green Water Analysis', NULL, 29),
    (v_tenant_id, gen_random_uuid(), 'PROJECT_MANAGEMENT_OPERATION'::public.document_group_code, '601', 'Method Statement', NULL, 1),
    (v_tenant_id, gen_random_uuid(), 'PROJECT_MANAGEMENT_OPERATION'::public.document_group_code, '602', 'Voyage & Weather Routing Plan', NULL, 2),
    (v_tenant_id, gen_random_uuid(), 'PROJECT_MANAGEMENT_OPERATION'::public.document_group_code, '603', 'HSEQ Management Plan', NULL, 3),
    (v_tenant_id, gen_random_uuid(), 'PROJECT_MANAGEMENT_OPERATION'::public.document_group_code, '604', 'Safe Working Plan', NULL, 4),
    (v_tenant_id, gen_random_uuid(), 'PROJECT_MANAGEMENT_OPERATION'::public.document_group_code, '605', 'Emergency Response Plan', NULL, 5),
    (v_tenant_id, gen_random_uuid(), 'PROJECT_MANAGEMENT_OPERATION'::public.document_group_code, '606', 'Anti-Piracy Plan', NULL, 6),
    (v_tenant_id, gen_random_uuid(), 'PROJECT_MANAGEMENT_OPERATION'::public.document_group_code, '607', 'Crew Management Plan', NULL, 7),
    (v_tenant_id, gen_random_uuid(), 'PROJECT_MANAGEMENT_OPERATION'::public.document_group_code, '608', 'Vessel Maintenance Plan', NULL, 8)
  ON CONFLICT DO NOTHING;$new$;
BEGIN
  SELECT pg_get_functiondef(
    'public.provision_company_workspace_core(text, text, uuid, text, text, text, text, text)'::regprocedure
  ) INTO v_definition;

  IF position(v_old_catalogue_tail IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Expected Engineering document-code catalogue was not found in provision_company_workspace_core';
  END IF;

  v_definition := replace(v_definition, v_old_catalogue_tail, v_new_catalogue_tail);
  EXECUTE v_definition;
END;
$migration$;

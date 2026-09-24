-- Provision the Engineering starter catalogue through the shared document-code
-- persistence. These are ordinary starter records, not numeric validation ranges
-- or a closed catalogue. Every listed pair is represented by separate records.
--
-- Rollback: remove only Engineering rows confirmed unreferenced, then restore the
-- preceding provisioning function. Do not delete/recreate referenced rows because
-- documents retain document_code_id foreign keys.

INSERT INTO public.document_code_options (
  tenant_id, id, document_group, code, name, description, sort_order, is_active
)
SELECT
  tenant.id,
  gen_random_uuid(),
  'ENGINEERING'::public.document_group_code,
  catalogue.code,
  catalogue.name,
  NULL,
  catalogue.sort_order,
  true
FROM public.tenants AS tenant
CROSS JOIN (
  VALUES
    ('100', 'Stowage Plan', 1),
    ('101', 'Shipment Calculation', 2),
    ('110', 'Intereference Check', 3),
    ('130', 'Berthing Feasibility Check', 4),
    ('200', 'Loading Condition-Voyage Condition', 5),
    ('211', 'Stern Ballast Plan for Loading', 6),
    ('212', 'Stern Ballast Plan for Discharging', 7),
    ('221', 'Side Ballast Plan for Loading', 8),
    ('222', 'Side Ballast Plan for Discharging', 9),
    ('231', 'Ballast Plan for Float On', 10),
    ('232', 'Ballast Plan for Float Off', 11),
    ('250', 'Stability Report (Intact, Damage)', 12),
    ('301', 'Mooring Arrangement Plan at POL', 13),
    ('302', 'Mooring Arrangement Plan at POD', 14),
    ('341', 'Mooring Procedure Plan at POL', 15),
    ('342', 'Mooring Procedure Plan at POD', 16),
    ('351', 'Mooring Analysis Report at POL', 17),
    ('352', 'Mooring Analysis Report at POD', 18),
    ('361', 'Port Entry Plan at POL', 19),
    ('362', 'Port Entry Plan at POD', 20),
    ('371', 'Berthing Procedure Report at POL', 21),
    ('372', 'Berthing Procedure Report at POD', 22),
    ('400', 'Voyage Route Analysis', 23),
    ('410', 'Summary of Motion Analysis Report', 24),
    ('411', 'Speed vs Acceleration', 25),
    ('412', 'Static Applied Wind Pressure Trim Calculation', 26),
    ('420', 'RAO', 27),
    ('430', 'Critical Motion Curve', 28),
    ('440', 'Green Water Analysis', 29)
) AS catalogue(code, name, sort_order)
ON CONFLICT (tenant_id, document_group, code) DO NOTHING;

-- Append Engineering rows to the company-provisioning catalogue. The definition
-- is taken from the immediately preceding migration state, preserving unrelated
-- provisioning, grants, and RLS/security behavior.
DO $migration$
DECLARE
  v_definition text;
  v_old_catalogue_tail text := $old$
    (v_tenant_id, gen_random_uuid(), 'ETC'::public.document_group_code, '901', 'Lesson and Learnt', NULL, 1),
    (v_tenant_id, gen_random_uuid(), 'ETC'::public.document_group_code, '902', 'Picture', NULL, 2),
    (v_tenant_id, gen_random_uuid(), 'ETC'::public.document_group_code, '999', 'Backup', NULL, 3)
  ON CONFLICT DO NOTHING;$old$;
  v_new_catalogue_tail text := $new$
    (v_tenant_id, gen_random_uuid(), 'ETC'::public.document_group_code, '901', 'Lesson and Learnt', NULL, 1),
    (v_tenant_id, gen_random_uuid(), 'ETC'::public.document_group_code, '902', 'Picture', NULL, 2),
    (v_tenant_id, gen_random_uuid(), 'ETC'::public.document_group_code, '999', 'Backup', NULL, 3),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '100', 'Stowage Plan', NULL, 1),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '101', 'Shipment Calculation', NULL, 2),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '110', 'Intereference Check', NULL, 3),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '130', 'Berthing Feasibility Check', NULL, 4),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '200', 'Loading Condition-Voyage Condition', NULL, 5),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '211', 'Stern Ballast Plan for Loading', NULL, 6),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '212', 'Stern Ballast Plan for Discharging', NULL, 7),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '221', 'Side Ballast Plan for Loading', NULL, 8),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '222', 'Side Ballast Plan for Discharging', NULL, 9),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '231', 'Ballast Plan for Float On', NULL, 10),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '232', 'Ballast Plan for Float Off', NULL, 11),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '250', 'Stability Report (Intact, Damage)', NULL, 12),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '301', 'Mooring Arrangement Plan at POL', NULL, 13),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '302', 'Mooring Arrangement Plan at POD', NULL, 14),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '341', 'Mooring Procedure Plan at POL', NULL, 15),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '342', 'Mooring Procedure Plan at POD', NULL, 16),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '351', 'Mooring Analysis Report at POL', NULL, 17),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '352', 'Mooring Analysis Report at POD', NULL, 18),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '361', 'Port Entry Plan at POL', NULL, 19),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '362', 'Port Entry Plan at POD', NULL, 20),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '371', 'Berthing Procedure Report at POL', NULL, 21),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '372', 'Berthing Procedure Report at POD', NULL, 22),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '400', 'Voyage Route Analysis', NULL, 23),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '410', 'Summary of Motion Analysis Report', NULL, 24),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '411', 'Speed vs Acceleration', NULL, 25),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '412', 'Static Applied Wind Pressure Trim Calculation', NULL, 26),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '420', 'RAO', NULL, 27),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '430', 'Critical Motion Curve', NULL, 28),
    (v_tenant_id, gen_random_uuid(), 'ENGINEERING'::public.document_group_code, '440', 'Green Water Analysis', NULL, 29)
  ON CONFLICT DO NOTHING;$new$;
BEGIN
  SELECT pg_get_functiondef(
    'public.provision_company_workspace_core(text, text, uuid, text, text, text, text, text)'::regprocedure
  ) INTO v_definition;

  IF position(v_old_catalogue_tail IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Expected ETC document-code catalogue was not found in provision_company_workspace_core';
  END IF;

  v_definition := replace(v_definition, v_old_catalogue_tail, v_new_catalogue_tail);
  EXECUTE v_definition;
END;
$migration$;

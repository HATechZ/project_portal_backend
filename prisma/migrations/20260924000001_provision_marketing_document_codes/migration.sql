-- Reclassify the legacy General catalogue without changing document-code IDs or
-- documentCodeId foreign keys, then provision the Marketing starter catalogue.
-- The code values are starter data only and are not numeric validation ranges.
--
-- Rollback: reclassify only unreferenced rows after reviewing tenant data. Do
-- not delete or recreate code rows because document/file records reference IDs.

UPDATE public.document_code_options
SET document_group = 'GENERAL'::public.document_group_code
WHERE document_group = 'MARKETING'::public.document_group_code
  AND code NOT IN ('802', '803');

INSERT INTO public.document_code_options (
  tenant_id, id, document_group, code, name, description, sort_order, is_active
)
SELECT
  tenant.id,
  gen_random_uuid(),
  'MARKETING'::public.document_group_code,
  catalogue.code,
  catalogue.name,
  NULL,
  catalogue.sort_order,
  true
FROM public.tenants AS tenant
CROSS JOIN (
  VALUES
    ('801', '수주통보서', 1),
    ('802', 'Contract', 2),
    ('803', 'Invoice', 3)
) AS catalogue(code, name, sort_order)
ON CONFLICT (tenant_id, document_group, code) DO NOTHING;

-- New tenants continue to receive the current General starter catalogue plus
-- the Marketing starter catalogue through the existing provisioning function.
-- The function is reconstructed from the immediately preceding approved
-- definition so all unrelated provisioning, grants, and security attributes
-- remain unchanged.
DO $migration$
DECLARE
  v_definition text;
  v_old_catalogue text := $old$
  INSERT INTO public.document_code_options (tenant_id, id, document_group, code, name, description)
  VALUES
    (v_tenant_id, gen_random_uuid(), 'MARKETING'::public.document_group_code, '000', 'Info', NULL),
    (v_tenant_id, gen_random_uuid(), 'MARKETING'::public.document_group_code, '001', 'Project Information', NULL),
    (v_tenant_id, gen_random_uuid(), 'MARKETING'::public.document_group_code, '002', 'Cargo Information', NULL),
    (v_tenant_id, gen_random_uuid(), 'MARKETING'::public.document_group_code, '011', 'Action Log', NULL),
    (v_tenant_id, gen_random_uuid(), 'MARKETING'::public.document_group_code, '012', 'Contact List', NULL),
    (v_tenant_id, gen_random_uuid(), 'MARKETING'::public.document_group_code, '013', 'Comment Sheet', NULL),
    (v_tenant_id, gen_random_uuid(), 'MARKETING'::public.document_group_code, '802', 'Contract', NULL),
    (v_tenant_id, gen_random_uuid(), 'MARKETING'::public.document_group_code, '803', 'Invoice', NULL)
  ON CONFLICT DO NOTHING;$old$;
  v_new_catalogue text := $new$
  INSERT INTO public.document_code_options (tenant_id, id, document_group, code, name, description, sort_order)
  VALUES
    (v_tenant_id, gen_random_uuid(), 'GENERAL'::public.document_group_code, '000', 'Info', NULL, 1),
    (v_tenant_id, gen_random_uuid(), 'GENERAL'::public.document_group_code, '001', 'Project Information', NULL, 2),
    (v_tenant_id, gen_random_uuid(), 'GENERAL'::public.document_group_code, '002', 'Cargo Information', NULL, 3),
    (v_tenant_id, gen_random_uuid(), 'GENERAL'::public.document_group_code, '011', 'Action Log', NULL, 4),
    (v_tenant_id, gen_random_uuid(), 'GENERAL'::public.document_group_code, '012', 'Contact List', NULL, 5),
    (v_tenant_id, gen_random_uuid(), 'GENERAL'::public.document_group_code, '013', 'Comment Sheet', NULL, 6),
    (v_tenant_id, gen_random_uuid(), 'MARKETING'::public.document_group_code, '801', '수주통보서', NULL, 1),
    (v_tenant_id, gen_random_uuid(), 'MARKETING'::public.document_group_code, '802', 'Contract', NULL, 2),
    (v_tenant_id, gen_random_uuid(), 'MARKETING'::public.document_group_code, '803', 'Invoice', NULL, 3)
  ON CONFLICT DO NOTHING;$new$;
BEGIN
  SELECT pg_get_functiondef(
    'public.provision_company_workspace_core(text, text, uuid, text, text, text, text, text)'::regprocedure
  ) INTO v_definition;

  IF position(v_old_catalogue IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Expected legacy document-code catalogue was not found in provision_company_workspace_core';
  END IF;

  v_definition := replace(v_definition, v_old_catalogue, v_new_catalogue);
  EXECUTE v_definition;
END;
$migration$;

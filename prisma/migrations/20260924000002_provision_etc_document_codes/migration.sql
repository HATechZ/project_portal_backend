-- Provision the ETC starter catalogue through the existing shared document-code
-- persistence. These are ordinary starter records, not a numeric range or a
-- closed catalogue.
--
-- Rollback: remove only ETC rows confirmed unreferenced, then restore the
-- preceding provisioning function. Do not delete/recreate referenced rows,
-- because documents retain document_code_id foreign keys.

INSERT INTO public.document_code_options (
  tenant_id, id, document_group, code, name, description, sort_order, is_active
)
SELECT
  tenant.id,
  gen_random_uuid(),
  'ETC'::public.document_group_code,
  catalogue.code,
  catalogue.name,
  NULL,
  catalogue.sort_order,
  true
FROM public.tenants AS tenant
CROSS JOIN (
  VALUES
    ('901', 'Lesson and Learnt', 1),
    ('902', 'Picture', 2),
    ('999', 'Backup', 3)
) AS catalogue(code, name, sort_order)
ON CONFLICT (tenant_id, document_group, code) DO NOTHING;

-- Add ETC rows to the company-provisioning catalogue. The definition is read
-- from the preceding migration state so unrelated provisioning, grants, and
-- security attributes remain unchanged.
DO $migration$
DECLARE
  v_definition text;
  v_old_catalogue_tail text := $old$
    (v_tenant_id, gen_random_uuid(), 'MARKETING'::public.document_group_code, '802', 'Contract', NULL, 2),
    (v_tenant_id, gen_random_uuid(), 'MARKETING'::public.document_group_code, '803', 'Invoice', NULL, 3)
  ON CONFLICT DO NOTHING;$old$;
  v_new_catalogue_tail text := $new$
    (v_tenant_id, gen_random_uuid(), 'MARKETING'::public.document_group_code, '802', 'Contract', NULL, 2),
    (v_tenant_id, gen_random_uuid(), 'MARKETING'::public.document_group_code, '803', 'Invoice', NULL, 3),
    (v_tenant_id, gen_random_uuid(), 'ETC'::public.document_group_code, '901', 'Lesson and Learnt', NULL, 1),
    (v_tenant_id, gen_random_uuid(), 'ETC'::public.document_group_code, '902', 'Picture', NULL, 2),
    (v_tenant_id, gen_random_uuid(), 'ETC'::public.document_group_code, '999', 'Backup', NULL, 3)
  ON CONFLICT DO NOTHING;$new$;
BEGIN
  SELECT pg_get_functiondef(
    'public.provision_company_workspace_core(text, text, uuid, text, text, text, text, text)'::regprocedure
  ) INTO v_definition;

  IF position(v_old_catalogue_tail IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Expected Marketing document-code catalogue was not found in provision_company_workspace_core';
  END IF;

  v_definition := replace(v_definition, v_old_catalogue_tail, v_new_catalogue_tail);
  EXECUTE v_definition;
END;
$migration$;

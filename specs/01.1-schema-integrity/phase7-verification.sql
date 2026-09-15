-- Returns one PASS row per named Phase 7 FK; any mismatch is FAIL.
WITH expected(name, child_table, child_cols, parent_table, parent_cols, del_action, upd_action, set_cols) AS (
  VALUES
  ('documents_project_id_tenant_id_fkey','documents',ARRAY['project_id','tenant_id'],'projects',ARRAY['id','tenant_id'],'r','c',ARRAY[]::text[]),
  ('documents_work_request_id_project_id_fkey','documents',ARRAY['work_request_id','project_id'],'work_requests',ARRAY['id','project_id'],'n','c',ARRAY['work_request_id']),
  ('work_requests_project_id_tenant_id_fkey','work_requests',ARRAY['project_id','tenant_id'],'projects',ARRAY['id','tenant_id'],'r','c',ARRAY[]::text[]),
  ('work_requests_assigned_division_id_tenant_id_fkey','work_requests',ARRAY['assigned_division_id','tenant_id'],'divisions',ARRAY['id','tenant_id'],'r','c',ARRAY[]::text[]),
  ('work_requests_origin_division_id_tenant_id_fkey','work_requests',ARRAY['origin_division_id','tenant_id'],'divisions',ARRAY['id','tenant_id'],'r','c',ARRAY[]::text[]),
  ('registry_documents_project_id_tenant_id_fkey','registry_documents',ARRAY['project_id','tenant_id'],'projects',ARRAY['id','tenant_id'],'r','c',ARRAY[]::text[]),
  ('registry_documents_work_request_id_tenant_id_fkey','registry_documents',ARRAY['work_request_id','tenant_id'],'work_requests',ARRAY['id','tenant_id'],'r','c',ARRAY[]::text[]),
  ('registry_documents_document_id_tenant_id_fkey','registry_documents',ARRAY['document_id','tenant_id'],'documents',ARRAY['id','tenant_id'],'n','c',ARRAY['document_id']),
  ('actor_profiles_member_id_tenant_id_fkey','actor_profiles',ARRAY['member_id','tenant_id'],'members',ARRAY['id','tenant_id'],'n','c',ARRAY['member_id']),
  ('actor_profiles_client_contact_id_tenant_id_fkey','actor_profiles',ARRAY['client_contact_id','tenant_id'],'client_contacts',ARRAY['id','tenant_id'],'n','c',ARRAY['client_contact_id']),
  ('notification_recipients_notification_id_tenant_id_fkey','notification_recipients',ARRAY['notification_id','tenant_id'],'notifications',ARRAY['id','tenant_id'],'r','c',ARRAY[]::text[]),
  ('notification_recipients_actor_id_tenant_id_fkey','notification_recipients',ARRAY['actor_id','tenant_id'],'actor_profiles',ARRAY['id','tenant_id'],'r','c',ARRAY[]::text[])
), actual AS (
 SELECT c.conname name, cr.relname child_table, pr.relname parent_table, c.confdeltype::text del_action, c.confupdtype::text upd_action,
   ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(attnum,ord) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum ORDER BY k.ord) child_cols,
   ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(attnum,ord) JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.attnum ORDER BY k.ord) parent_cols,
   COALESCE(ARRAY(SELECT a.attname::text FROM unnest(c.confdelsetcols) WITH ORDINALITY k(attnum,ord) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum ORDER BY k.ord),ARRAY[]::text[]) set_cols
 FROM pg_constraint c JOIN pg_class cr ON cr.oid=c.conrelid JOIN pg_class pr ON pr.oid=c.confrelid WHERE c.contype='f'
)
SELECT e.name, CASE WHEN a.name IS NOT NULL AND (a.child_table,a.child_cols,a.parent_table,a.parent_cols,a.del_action,a.upd_action,a.set_cols)=(e.child_table,e.child_cols,e.parent_table,e.parent_cols,e.del_action,e.upd_action,e.set_cols) THEN 'PASS' ELSE 'FAIL' END result
FROM expected e LEFT JOIN actual a USING(name) ORDER BY e.name;

-- Named parent/coherence handles and supporting indexes: every row must be present and valid.
SELECT n, to_regclass('public.'||n) IS NOT NULL AS present FROM unnest(ARRAY[
 'projects_id_tenant_id_key','divisions_id_tenant_id_key','work_requests_id_tenant_id_key','documents_id_tenant_id_key',
 'members_id_tenant_id_key','client_contacts_id_tenant_id_key','notifications_id_tenant_id_key','actor_profiles_id_tenant_id_key',
 'work_requests_id_project_id_key','documents_project_id_tenant_id_idx','documents_work_request_id_project_id_idx',
 'work_requests_project_id_tenant_id_idx','work_requests_assigned_division_id_tenant_id_idx','work_requests_origin_division_id_tenant_id_idx',
 'registry_documents_project_id_tenant_id_idx','registry_documents_work_request_id_tenant_id_idx','registry_documents_document_id_tenant_id_idx',
 'actor_profiles_member_id_tenant_id_idx','actor_profiles_client_contact_id_tenant_id_idx',
 'notification_recipients_notification_id_tenant_id_idx','notification_recipients_actor_id_tenant_id_idx'
]) n;

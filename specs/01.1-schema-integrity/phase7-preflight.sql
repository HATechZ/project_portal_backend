-- Read-only: every query must return zero rows before Phase 7 is applied.
SELECT d.id FROM documents d LEFT JOIN projects p ON (p.id,p.tenant_id)=(d.project_id,d.tenant_id) WHERE p.id IS NULL;
SELECT d.id FROM documents d LEFT JOIN work_requests w ON (w.id,w.project_id)=(d.work_request_id,d.project_id) WHERE d.work_request_id IS NOT NULL AND w.id IS NULL;
SELECT w.id FROM work_requests w LEFT JOIN projects p ON (p.id,p.tenant_id)=(w.project_id,w.tenant_id) WHERE p.id IS NULL;
SELECT w.id FROM work_requests w LEFT JOIN divisions d ON (d.id,d.tenant_id)=(w.assigned_division_id,w.tenant_id) WHERE d.id IS NULL;
SELECT w.id FROM work_requests w LEFT JOIN divisions d ON (d.id,d.tenant_id)=(w.origin_division_id,w.tenant_id) WHERE d.id IS NULL;
SELECT r.id FROM registry_documents r LEFT JOIN projects p ON (p.id,p.tenant_id)=(r.project_id,r.tenant_id) WHERE p.id IS NULL;
SELECT r.id FROM registry_documents r LEFT JOIN work_requests w ON (w.id,w.tenant_id)=(r.work_request_id,r.tenant_id) WHERE w.id IS NULL;
SELECT r.id FROM registry_documents r LEFT JOIN documents d ON (d.id,d.tenant_id)=(r.document_id,r.tenant_id) WHERE r.document_id IS NOT NULL AND d.id IS NULL;
SELECT a.id FROM actor_profiles a LEFT JOIN members m ON (m.id,m.tenant_id)=(a.member_id,a.tenant_id) WHERE a.member_id IS NOT NULL AND m.id IS NULL;
SELECT a.id FROM actor_profiles a LEFT JOIN client_contacts c ON (c.id,c.tenant_id)=(a.client_contact_id,a.tenant_id) WHERE a.client_contact_id IS NOT NULL AND c.id IS NULL;
SELECT r.id FROM notification_recipients r LEFT JOIN notifications n ON (n.id,n.tenant_id)=(r.notification_id,r.tenant_id) WHERE n.id IS NULL;
SELECT r.id FROM notification_recipients r LEFT JOIN actor_profiles a ON (a.id,a.tenant_id)=(r.actor_id,r.tenant_id) WHERE a.id IS NULL;

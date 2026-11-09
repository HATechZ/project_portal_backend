-- Restore the least-privilege runtime write needed by the atomic document-upload
-- receipt/audit transaction. Tenant scope remains enforced by the existing
-- tenant_isolation_system_audit_logs RLS policy.
--
-- No sequence grant is required: system_audit_logs.id is UUID supplied by the
-- application, not an identity/serial column.
--
-- Rollback: REVOKE INSERT ON TABLE public.system_audit_logs FROM app_user;

GRANT INSERT ON TABLE public.system_audit_logs TO app_user;

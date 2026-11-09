-- Prisma create returns the inserted audit row and therefore requires SELECT.
-- Existing tenant RLS remains in force and the INSERT grant is unchanged.
-- Rollback: REVOKE SELECT ON TABLE public.system_audit_logs FROM app_user;

GRANT SELECT ON TABLE public.system_audit_logs TO app_user;

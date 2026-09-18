-- Grant the Module 06 runtime surface to app_user.
--
-- option_types is a global, fixed catalogue and has no RLS policy; the runtime
-- resolves a fixed code before accessing tenant-owned values. option_values and
-- bid_details already have app_user tenant RLS policies from
-- 20260901000000_enable_tenant_rls. This migration adds only the table
-- privileges required by the implemented repository paths; it does not alter
-- RLS or grant DELETE.
--
-- Rollback:
-- REVOKE SELECT ON TABLE "option_types", "bid_details" FROM app_user;
-- REVOKE SELECT, INSERT, UPDATE ON TABLE "option_values" FROM app_user;

GRANT SELECT ON TABLE "option_types" TO app_user;

GRANT SELECT, INSERT, UPDATE ON TABLE "option_values" TO app_user;

GRANT SELECT ON TABLE "bid_details" TO app_user;

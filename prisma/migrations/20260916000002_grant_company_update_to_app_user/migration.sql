-- The Company repository has an implemented update path. Phase 6 granted the
-- tenant-scoped read/creation surface and later organization migrations granted
-- Division, Member, Team, Client, and ClientContact writes, but omitted this
-- Company UPDATE privilege. RLS remains the tenant authorization boundary.
--
-- Rollback: REVOKE UPDATE ON TABLE public.companies FROM app_user;

GRANT UPDATE ON TABLE public.companies TO app_user;

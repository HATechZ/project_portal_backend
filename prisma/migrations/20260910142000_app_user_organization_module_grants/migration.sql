-- Grant the app_user privileges required by the implemented Division, Member,
-- Team, and Team membership repositories after the Phase 6 RLS baseline.
-- This is a forward replacement for the unrecoverable historical dev migration
-- 20260909104500_app_user_division_grants; it intentionally does not recreate
-- that migration name or checksum.
--
-- Rollback note: revoke only these incremental grants after first ensuring no
-- deployed repository path still requires them.

GRANT SELECT ON TABLE
  "division_types",
  "projects",
  "work_requests"
TO app_user;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  "divisions",
  "members",
  "teams"
TO app_user;

GRANT SELECT, INSERT, UPDATE ON TABLE
  "team_members",
  "actor_profiles"
TO app_user;

-- Member deletion checks nested workflow dependency relations before deleting.
-- These reads remain tenant-isolated by the existing RLS policies; this adds
-- no write access and deliberately grants nothing to app_relay.
--
-- Rollback: REVOKE SELECT ON TABLE public.work_request_assignments,
-- public.workflow_info_requests, public.work_request_revision_requests FROM app_user;

GRANT SELECT ON TABLE
  public.work_request_assignments,
  public.workflow_info_requests,
  public.work_request_revision_requests
TO app_user;

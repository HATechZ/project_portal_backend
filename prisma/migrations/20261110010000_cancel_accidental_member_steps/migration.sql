-- PREPARED ONLY. Owner must apply together with cancellation-aware runtime.
-- Preserve normal execution and audit identities; never delete history.
BEGIN;
ALTER TABLE "work_request_member_steps" ADD COLUMN "cancelled_at" TIMESTAMP(6);
ALTER TABLE "work_request_member_steps" ADD CONSTRAINT "wr_member_step_cancelled_unused"
  CHECK ("cancelled_at" IS NULL OR ("activated_at" IS NULL AND "submitted_at" IS NULL));

CREATE FUNCTION enforce_work_request_member_step_cancellation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.cancelled_at IS NOT NULL THEN
      RAISE EXCEPTION 'Member steps must be created uncancelled';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.cancelled_at IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Cancelled Member steps are immutable';
  END IF;
  IF NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at THEN
    IF OLD.activated_at IS NOT NULL OR OLD.submitted_at IS NOT NULL
       OR NEW.activated_at IS NOT NULL OR NEW.submitted_at IS NOT NULL
       OR (to_jsonb(NEW) - 'cancelled_at') IS DISTINCT FROM (to_jsonb(OLD) - 'cancelled_at')
       OR EXISTS (SELECT 1 FROM work_request_member_step_submissions s
                  WHERE s.tenant_id = OLD.tenant_id AND s.member_step_id = OLD.id)
       OR EXISTS (SELECT 1 FROM work_request_route_revisions r
                  WHERE r.tenant_id = OLD.tenant_id AND
                    OLD.id IN (r.requester_member_step_id, r.source_member_step_id, r.resume_member_step_id))
       OR EXISTS (SELECT 1 FROM work_request_route_projections p
                  WHERE p.tenant_id = OLD.tenant_id AND p.member_step_id = OLD.id)
    THEN RAISE EXCEPTION 'Only unused unreferenced future Member steps may be cancelled';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER wr_member_steps_cancellation BEFORE INSERT OR UPDATE
  ON work_request_member_steps FOR EACH ROW
  EXECUTE FUNCTION enforce_work_request_member_step_cancellation();

-- A clean/new database has no incident route and needs only the schema change.
-- An existing incident route must still match the diagnosed state exactly.
LOCK TABLE work_request_route_projections, work_request_route_revisions,
  work_request_member_step_submissions IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE affected integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM work_request_routes
      WHERE id = '6e00f3ea-a714-4378-abcf-b169ae64a24e'
        AND tenant_id = 'a009def8-f086-40d7-8c28-3f55766ca2ca'
        AND work_request_id = '79c868c1-23b3-4362-a209-b1db1e05ae5b') THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM work_request_route_projections
      WHERE route_id = '6e00f3ea-a714-4378-abcf-b169ae64a24e'
        AND tenant_id = 'a009def8-f086-40d7-8c28-3f55766ca2ca'
        AND team_step_id = 'ccfe6d68-1f90-48d5-a5f1-4c9746a892a5'
        AND member_step_id = 'b58b487e-53b7-40f7-b758-b4c838d355f6'
        AND open_revision_id IS NULL) THEN
    RAISE EXCEPTION 'Incident projection changed; re-audit before Member-step repair';
  END IF;
  UPDATE work_request_member_steps ms SET cancelled_at = CURRENT_TIMESTAMP
  WHERE ms.tenant_id = 'a009def8-f086-40d7-8c28-3f55766ca2ca'
    AND ms.route_id = '6e00f3ea-a714-4378-abcf-b169ae64a24e'
    AND ms.team_step_id = 'ccfe6d68-1f90-48d5-a5f1-4c9746a892a5'
    AND ms.activated_at IS NULL AND ms.submitted_at IS NULL
    AND ((ms.id = '29f69afb-5b5a-43ed-b034-047caf3b55c1' AND ms.ordinal = 3
          AND ms.member_id = '5863e547-2cda-4800-bcc1-a4a903d33f6c')
      OR (ms.id = '4c6a43a5-6ccc-449c-9f84-5d4c0b70855f' AND ms.ordinal = 4
          AND ms.member_id = '33c16e29-0fc1-4870-83cd-1653644bb59b'))
    AND EXISTS (SELECT 1 FROM work_request_route_events e
      WHERE e.tenant_id = ms.tenant_id AND e.route_id = ms.route_id
        AND e.member_step_id = ms.id AND e.action = 'MEMBER_STEP_APPENDED');
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 2 THEN
    RAISE EXCEPTION 'Expected exactly two diagnosed unused appends, found %', affected;
  END IF;
END; $$;
COMMIT;

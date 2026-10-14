-- Add generic Work Request V1 review stages and responsibility assignment
-- levels without changing historical states, actions, or assignment rows.
--
-- Rollback: stop writes that use these enum values, preserve any event history
-- that must be retained, then rebuild the affected PostgreSQL enum types
-- without the new values. Drop responsibility_level only after consumers no
-- longer read it, and restore the prior assignment target CHECK.

ALTER TYPE "work_request_v1_assignment_level_code" ADD VALUE IF NOT EXISTS 'CHECKING';
ALTER TYPE "work_request_v1_assignment_level_code" ADD VALUE IF NOT EXISTS 'APPROVAL';
ALTER TYPE "work_request_v1_assignment_level_code" ADD VALUE IF NOT EXISTS 'FINAL_REVIEW';

ALTER TYPE "work_request_v1_state_code" ADD VALUE IF NOT EXISTS 'CHECKING_REVIEW';
ALTER TYPE "work_request_v1_state_code" ADD VALUE IF NOT EXISTS 'APPROVAL_REVIEW';
ALTER TYPE "work_request_v1_state_code" ADD VALUE IF NOT EXISTS 'FINAL_REVIEW';
ALTER TYPE "work_request_v1_state_code" ADD VALUE IF NOT EXISTS 'FINAL_RELEASE';

ALTER TYPE "workflow_action_code" ADD VALUE IF NOT EXISTS 'WR_CHECKING_APPROVE';
ALTER TYPE "workflow_action_code" ADD VALUE IF NOT EXISTS 'WR_APPROVAL_APPROVE';
ALTER TYPE "workflow_action_code" ADD VALUE IF NOT EXISTS 'WR_REQUEST_REVISION';
ALTER TYPE "workflow_action_code" ADD VALUE IF NOT EXISTS 'WR_FINAL_RELEASE';

ALTER TABLE "work_request_v1_events"
  ADD COLUMN "responsibility_level" "work_request_v1_assignment_level_code";

ALTER TABLE "work_request_v1_assignments"
  DROP CONSTRAINT "work_request_v1_assignments_level_target_check",
  ADD CONSTRAINT "work_request_v1_assignments_level_target_check" CHECK (
    ("level"::text = 'DIVISION' AND "division_id" IS NOT NULL AND "team_id" IS NULL AND "member_id" IS NULL)
    OR ("level"::text = 'TEAM' AND "division_id" IS NULL AND "team_id" IS NOT NULL AND "member_id" IS NULL)
    OR ("level"::text IN ('MEMBER', 'CHECKING', 'APPROVAL', 'FINAL_REVIEW')
      AND "division_id" IS NULL AND "team_id" IS NULL AND "member_id" IS NOT NULL)
  );

-- Expand the Workflow Action catalogue for Module 10 before its definitions
-- are provisioned by the existing idempotent permission seed. These actions
-- intentionally receive no role grants in this migration.
--
-- Rollback note: PostgreSQL enum values cannot be dropped directly. Before
-- definitions, role grants, or audit data depend on them, rebuild
-- workflow_action_code without these values and cast
-- workflow_action_definitions.code through text, following 20260821000000.

ALTER TYPE "workflow_action_code" ADD VALUE IF NOT EXISTS 'VIEW_WORK_REQUEST';
ALTER TYPE "workflow_action_code" ADD VALUE IF NOT EXISTS 'UPDATE_WORK_REQUEST';
ALTER TYPE "workflow_action_code" ADD VALUE IF NOT EXISTS 'WR_ASSIGN_DIVISION';
ALTER TYPE "workflow_action_code" ADD VALUE IF NOT EXISTS 'WR_ASSIGN_TEAM';
ALTER TYPE "workflow_action_code" ADD VALUE IF NOT EXISTS 'WR_ASSIGN_MEMBER';
ALTER TYPE "workflow_action_code" ADD VALUE IF NOT EXISTS 'WR_SUBMIT';
ALTER TYPE "workflow_action_code" ADD VALUE IF NOT EXISTS 'WR_TEAM_LEAD_APPROVE';
ALTER TYPE "workflow_action_code" ADD VALUE IF NOT EXISTS 'WR_TEAM_LEAD_REQUEST_REVISION';
ALTER TYPE "workflow_action_code" ADD VALUE IF NOT EXISTS 'WR_DIVISION_LEAD_APPROVE';
ALTER TYPE "workflow_action_code" ADD VALUE IF NOT EXISTS 'WR_DIVISION_LEAD_REQUEST_REVISION';
ALTER TYPE "workflow_action_code" ADD VALUE IF NOT EXISTS 'WR_DIVISION_HEAD_APPROVE';
ALTER TYPE "workflow_action_code" ADD VALUE IF NOT EXISTS 'WR_DIVISION_HEAD_REQUEST_REVISION';

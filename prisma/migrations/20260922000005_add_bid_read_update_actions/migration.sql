-- Expand the action-grant catalogue before Bid read/update definitions and grants.
-- PostgreSQL enum additions must commit before a later migration can use them.
--
-- Rollback note: PostgreSQL enum values cannot be dropped directly. Before any
-- dependent rows exist, rebuild workflow_action_code without these values and
-- cast workflow_action_definitions.code through text, following 20260821000000.

ALTER TYPE "workflow_action_code"
  ADD VALUE IF NOT EXISTS 'VIEW_BID';

ALTER TYPE "workflow_action_code"
  ADD VALUE IF NOT EXISTS 'UPDATE_BID';

-- Expand the workflow action catalogue before its definition and grants are used.
-- PostgreSQL enum additions must commit before a later migration can use the value.
--
-- Rollback note: PostgreSQL enum values cannot be dropped directly. Before any
-- dependent rows exist, rebuild workflow_action_code without this value and cast
-- workflow_action_definitions.code through text, following 20260821000000.

ALTER TYPE "workflow_action_code"
  ADD VALUE IF NOT EXISTS 'MANAGE_DESIGNATIONS';

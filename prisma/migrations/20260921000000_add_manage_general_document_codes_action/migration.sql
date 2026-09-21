-- Expand the workflow action catalogue before creating its definition and grants.
-- PostgreSQL requires this enum addition to commit before the new value is used.
--
-- Rollback note: PostgreSQL enum values cannot be dropped directly. Before any
-- dependent rows exist, rebuild workflow_action_code without this value and cast
-- workflow_action_definitions.code through text, following 20260821000000.

ALTER TYPE "workflow_action_code"
  ADD VALUE IF NOT EXISTS 'MANAGE_GENERAL_DOCUMENT_CODES';

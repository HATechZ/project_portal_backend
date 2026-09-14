-- Expand the action-code reference set before seeding definitions in the next migration.
-- PostgreSQL makes newly added enum labels usable only after this migration commits.
--
-- Rollback note: PostgreSQL enum values cannot be dropped directly. Before any dependent
-- rows exist, rebuild workflow_action_code without these values and cast
-- workflow_action_definitions.code through text, following 20260821000000.

ALTER TYPE "workflow_action_code" ADD VALUE IF NOT EXISTS 'MANAGE_CLIENT';
ALTER TYPE "workflow_action_code" ADD VALUE IF NOT EXISTS 'MANAGE_CLIENT_CONTACT';
ALTER TYPE "workflow_action_code" ADD VALUE IF NOT EXISTS 'MANAGE_CLIENT_PORTAL_ACCESS';

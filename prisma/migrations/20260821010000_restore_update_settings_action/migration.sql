-- Repair databases where the preceding enum-rebuild migration was applied
-- before UPDATE_SETTINGS was restored to its workflow action list.
ALTER TYPE "workflow_action_code" ADD VALUE IF NOT EXISTS 'UPDATE_SETTINGS';

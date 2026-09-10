-- Add approved leadership role enum values.
-- Rollback note: PostgreSQL enum values cannot be dropped directly. To roll back
-- before any rows use these values, rebuild actor_role_code without
-- division_head/team_lead, casting roles.code through text as in
-- 20260821000000_remove_abandoned_role_and_action.

ALTER TYPE "actor_role_code" ADD VALUE IF NOT EXISTS 'division_head';
ALTER TYPE "actor_role_code" ADD VALUE IF NOT EXISTS 'team_lead';

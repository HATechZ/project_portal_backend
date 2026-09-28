-- Add the tenant custom-role scope needed for team-scoped access roles.
--
-- Rollback: PostgreSQL enum values cannot be removed in place. Recreate
-- public.custom_role_scope without 'team' only after all roles using it have
-- been migrated to another supported scope.

ALTER TYPE public.custom_role_scope ADD VALUE IF NOT EXISTS 'team';

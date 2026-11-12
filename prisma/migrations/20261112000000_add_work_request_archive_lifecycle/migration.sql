-- Add the Module 10 business archive overlay. Archive is intentionally distinct
-- from the legacy WorkRequest.deleted_at technical soft-delete field.
--
-- Rollback: after application code no longer reads these fields, remove the
-- foreign key and index, drop archived_at/archived_by_actor_id/archive_reason,
-- then remove the two permission-code labels in a separately reviewed enum
-- rebuild. PostgreSQL enum labels cannot be dropped directly.

ALTER TABLE public.work_requests_v1
  ADD COLUMN archived_at TIMESTAMP(6),
  ADD COLUMN archived_by_actor_id UUID,
  ADD COLUMN archive_reason TEXT;

ALTER TABLE public.work_requests_v1
  ADD CONSTRAINT work_requests_v1_archived_by_actor_id_tenant_id_fkey
  FOREIGN KEY (archived_by_actor_id, tenant_id)
  REFERENCES public.actor_profiles(id, tenant_id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX work_requests_v1_tenant_id_archived_at_idx
  ON public.work_requests_v1(tenant_id, archived_at);

-- The catalogue rows are deliberately installed by the immediately following
-- migration: PostgreSQL makes newly-added enum labels visible to later
-- transactions only.
ALTER TYPE public.permission_code ADD VALUE IF NOT EXISTS 'ARCHIVE_WORK_REQUEST';
ALTER TYPE public.permission_code ADD VALUE IF NOT EXISTS 'RESTORE_WORK_REQUEST';

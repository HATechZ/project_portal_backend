-- Add explicit ownership values to the shared document-code persistence enum.
-- These values describe module ownership; code values never determine ownership.
--
-- Rollback note: PostgreSQL enum values cannot be dropped directly. Before any
-- dependent rows exist, rebuild document_group_code without these values and
-- cast document_code_options.document_group through text.

ALTER TYPE public.document_group_code ADD VALUE IF NOT EXISTS 'GENERAL';
ALTER TYPE public.document_group_code ADD VALUE IF NOT EXISTS 'ETC';
ALTER TYPE public.document_group_code ADD VALUE IF NOT EXISTS 'PROJECT_MANAGEMENT_OPERATION';

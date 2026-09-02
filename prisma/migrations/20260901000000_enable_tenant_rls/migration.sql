-- Phase 6: database-enforced tenant isolation.
--
-- IMPORTANT: run this migration as a dedicated migration/table-owner role. PostgreSQL
-- table owners bypass RLS unless FORCE ROW LEVEL SECURITY is enabled; app_user and
-- app_relay therefore must not own these tables or execute migrations.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user
      LOGIN
      NOSUPERUSER
      NOCREATEROLE
      NOBYPASSRLS;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_relay') THEN
    CREATE ROLE app_relay
      LOGIN
      NOSUPERUSER
      NOCREATEROLE
      BYPASSRLS;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'app_user'
      AND rolcanlogin
      AND NOT rolsuper
      AND NOT rolcreaterole
      AND NOT rolbypassrls
  ) THEN
    RAISE EXCEPTION 'app_user must be LOGIN NOSUPERUSER NOCREATEROLE NOBYPASSRLS';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'app_relay'
      AND rolcanlogin
      AND NOT rolsuper
      AND NOT rolcreaterole
      AND rolbypassrls
  ) THEN
    RAISE EXCEPTION 'app_relay must be LOGIN NOSUPERUSER NOCREATEROLE BYPASSRLS';
  END IF;

  IF current_user IN ('app_user', 'app_relay') THEN
    RAISE EXCEPTION 'RLS migration must run as a dedicated migration/table-owner role';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class AS table_definition
    JOIN pg_namespace AS table_schema
      ON table_schema.oid = table_definition.relnamespace
    JOIN pg_roles AS table_owner
      ON table_owner.oid = table_definition.relowner
    WHERE table_schema.nspname = 'public'
      AND table_definition.relkind = 'r'
      AND table_owner.rolname IN ('app_user', 'app_relay')
  ) THEN
    RAISE EXCEPTION 'app_user and app_relay must not own public tables because owners bypass RLS';
  END IF;

  IF pg_has_role('app_user', 'app_relay', 'MEMBER') THEN
    RAISE EXCEPTION 'app_user must not be a member of app_relay or inherit relay privileges';
  END IF;
END
$$;

-- Clear stale direct application grants before applying the audited minimum set.
REVOKE ALL PRIVILEGES ON TABLE
  "actor_profiles",
  "archived_bid_review_requests",
  "attachment_file_groups",
  "attachment_source_types",
  "auth_session_consumed_refresh_tokens",
  "auth_sessions",
  "bid_details",
  "bid_outcome_events",
  "client_contacts",
  "clients",
  "companies",
  "company_types",
  "decision_results",
  "division_types",
  "divisions",
  "document_categories",
  "document_code_options",
  "document_folders",
  "document_version_folder_locations",
  "document_version_links",
  "document_versions",
  "documents",
  "info_request_statuses",
  "members",
  "notification_recipients",
  "notifications",
  "option_types",
  "option_values",
  "outbox_messages",
  "password_reset_tokens",
  "portal_configs",
  "processed_events",
  "project_conversion_events",
  "project_credential_deliveries",
  "project_status_events",
  "project_statuses",
  "projects",
  "registry_documents",
  "revision_request_statuses",
  "roles",
  "source_channels",
  "system_audit_logs",
  "team_members",
  "teams",
  "tenants",
  "user_roles",
  "users",
  "work_priorities",
  "work_request_assignments",
  "work_request_attachment_categories",
  "work_request_audit_attachments",
  "work_request_audit_logs",
  "work_request_categories",
  "work_request_decisions",
  "work_request_notes",
  "work_request_revision_documents",
  "work_request_revision_requests",
  "work_request_revision_submission_documents",
  "work_request_revision_submissions",
  "work_requests",
  "workflow_action_definitions",
  "workflow_action_role_permissions",
  "workflow_info_requests",
  "workflow_info_responses",
  "workflow_statuses",
  "workflow_transitions",
  "workspace_types"
FROM app_user;
DO $$
BEGIN
  IF to_regclass('public."_prisma_migrations"') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public."_prisma_migrations" FROM app_user';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_user, app_relay;

-- Minimum practical privileges derived from every implemented Prisma delegate operation and
-- nested relation read. Tables with no current application path receive no privileges.
GRANT SELECT ON TABLE
  "actor_profiles",
  "auth_session_consumed_refresh_tokens",
  "auth_sessions",
  "client_contacts",
  "clients",
  "companies",
  "tenants",
  "company_types",
  "divisions",
  "members",
  "outbox_messages",
  "password_reset_tokens",
  "processed_events",
  "roles",
  "user_roles",
  "users",
  "workflow_action_role_permissions",
  "workflow_action_definitions"
TO app_user;

GRANT INSERT ON TABLE
  "auth_session_consumed_refresh_tokens",
  "auth_sessions",
  "companies",
  "outbox_messages",
  "password_reset_tokens",
  "processed_events",
  "user_roles",
  "users",
  "workflow_action_role_permissions"
TO app_user;

GRANT UPDATE ON TABLE
  "auth_sessions",
  "password_reset_tokens",
  "user_roles",
  "users",
  "workflow_action_role_permissions"
TO app_user;

GRANT DELETE ON TABLE "users" TO app_user;

-- Remove any stale direct relay grants before applying its single-table grant.
REVOKE ALL PRIVILEGES ON TABLE
  "actor_profiles",
  "archived_bid_review_requests",
  "attachment_file_groups",
  "attachment_source_types",
  "auth_session_consumed_refresh_tokens",
  "auth_sessions",
  "bid_details",
  "bid_outcome_events",
  "client_contacts",
  "clients",
  "companies",
  "company_types",
  "decision_results",
  "division_types",
  "divisions",
  "document_categories",
  "document_code_options",
  "document_folders",
  "document_version_folder_locations",
  "document_version_links",
  "document_versions",
  "documents",
  "info_request_statuses",
  "members",
  "notification_recipients",
  "notifications",
  "option_types",
  "option_values",
  "password_reset_tokens",
  "portal_configs",
  "processed_events",
  "project_conversion_events",
  "project_credential_deliveries",
  "project_status_events",
  "project_statuses",
  "projects",
  "registry_documents",
  "revision_request_statuses",
  "roles",
  "source_channels",
  "system_audit_logs",
  "team_members",
  "teams",
  "tenants",
  "user_roles",
  "users",
  "work_priorities",
  "work_request_assignments",
  "work_request_attachment_categories",
  "work_request_audit_attachments",
  "work_request_audit_logs",
  "work_request_categories",
  "work_request_decisions",
  "work_request_notes",
  "work_request_revision_documents",
  "work_request_revision_requests",
  "work_request_revision_submission_documents",
  "work_request_revision_submissions",
  "work_requests",
  "workflow_action_definitions",
  "workflow_action_role_permissions",
  "workflow_info_requests",
  "workflow_info_responses",
  "workflow_statuses",
  "workflow_transitions",
  "workspace_types"
FROM app_relay;
DO $$
BEGIN
  IF to_regclass('public."_prisma_migrations"') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public."_prisma_migrations" FROM app_relay';
  END IF;
END
$$;

-- The privileged role is deliberately limited to the outbox relay table.
GRANT SELECT, UPDATE ON TABLE "outbox_messages" TO app_relay;

-- The tenant registry is the root of the scope rather than a tenant_id-bearing child.
-- Runtime code only checks activation for the current tenant, so expose that row only.
ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_tenants ON "tenants"
  AS PERMISSIVE
  FOR SELECT
  TO app_user
  USING ("id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "actor_profiles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_actor_profiles ON "actor_profiles"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "archived_bid_review_requests" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_archived_bid_review_requests ON "archived_bid_review_requests"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "auth_session_consumed_refresh_tokens" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_auth_session_consumed_refresh_tokens ON "auth_session_consumed_refresh_tokens"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "auth_sessions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_auth_sessions ON "auth_sessions"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "bid_details" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_bid_details ON "bid_details"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "bid_outcome_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_bid_outcome_events ON "bid_outcome_events"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "client_contacts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_client_contacts ON "client_contacts"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_clients ON "clients"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_companies ON "companies"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "divisions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_divisions ON "divisions"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "document_categories" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_document_categories ON "document_categories"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "document_code_options" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_document_code_options ON "document_code_options"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "document_folders" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_document_folders ON "document_folders"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "document_version_folder_locations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_document_version_folder_locations ON "document_version_folder_locations"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "document_version_links" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_document_version_links ON "document_version_links"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "document_versions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_document_versions ON "document_versions"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_documents ON "documents"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "members" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_members ON "members"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "notification_recipients" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_notification_recipients ON "notification_recipients"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_notifications ON "notifications"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "option_values" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_option_values ON "option_values"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "outbox_messages" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_outbox_messages ON "outbox_messages"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "password_reset_tokens" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_password_reset_tokens ON "password_reset_tokens"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "portal_configs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_portal_configs ON "portal_configs"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "processed_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_processed_events ON "processed_events"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "project_conversion_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_project_conversion_events ON "project_conversion_events"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "project_credential_deliveries" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_project_credential_deliveries ON "project_credential_deliveries"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "project_status_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_project_status_events ON "project_status_events"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_projects ON "projects"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "registry_documents" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_registry_documents ON "registry_documents"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "source_channels" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_source_channels ON "source_channels"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "system_audit_logs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_system_audit_logs ON "system_audit_logs"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "team_members" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_team_members ON "team_members"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_teams ON "teams"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_user_roles ON "user_roles"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_users ON "users"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "work_request_assignments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_work_request_assignments ON "work_request_assignments"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "work_request_attachment_categories" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_work_request_attachment_categories ON "work_request_attachment_categories"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "work_request_audit_attachments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_work_request_audit_attachments ON "work_request_audit_attachments"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "work_request_audit_logs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_work_request_audit_logs ON "work_request_audit_logs"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "work_request_categories" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_work_request_categories ON "work_request_categories"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "work_request_decisions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_work_request_decisions ON "work_request_decisions"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "work_request_notes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_work_request_notes ON "work_request_notes"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "work_request_revision_documents" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_work_request_revision_documents ON "work_request_revision_documents"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "work_request_revision_requests" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_work_request_revision_requests ON "work_request_revision_requests"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "work_request_revision_submission_documents" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_work_request_revision_submission_documents ON "work_request_revision_submission_documents"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "work_request_revision_submissions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_work_request_revision_submissions ON "work_request_revision_submissions"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "work_requests" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_work_requests ON "work_requests"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "workflow_action_role_permissions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_workflow_action_role_permissions ON "workflow_action_role_permissions"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "workflow_info_requests" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_workflow_info_requests ON "workflow_info_requests"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "workflow_info_responses" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_workflow_info_responses ON "workflow_info_responses"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

ALTER TABLE "workflow_transitions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_workflow_transitions ON "workflow_transitions"
  AS PERMISSIVE
  FOR ALL
  TO app_user
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

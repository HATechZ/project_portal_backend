-- Executable rollback for Phase 6 RLS. PREPARED ONLY; review before execution.
-- This removes only grants and policies introduced by the forward migration.
-- It does not restore unknown grants that the forward migration explicitly revoked.
-- It does not alter data, ownership, role attributes, credentials, or role existence.

BEGIN;

REVOKE USAGE ON SCHEMA public FROM app_user, app_relay;

REVOKE SELECT ON TABLE
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
FROM app_user;

REVOKE INSERT ON TABLE
  "auth_session_consumed_refresh_tokens",
  "auth_sessions",
  "companies",
  "outbox_messages",
  "password_reset_tokens",
  "processed_events",
  "user_roles",
  "users",
  "workflow_action_role_permissions"
FROM app_user;

REVOKE UPDATE ON TABLE
  "auth_sessions",
  "password_reset_tokens",
  "user_roles",
  "users",
  "workflow_action_role_permissions"
FROM app_user;

REVOKE DELETE ON TABLE
  "users"
FROM app_user;

REVOKE SELECT, UPDATE ON TABLE "outbox_messages" FROM app_relay;

DROP POLICY "tenant_isolation_tenants" ON "tenants";
DROP POLICY "tenant_isolation_actor_profiles" ON "actor_profiles";
DROP POLICY "tenant_isolation_archived_bid_review_requests" ON "archived_bid_review_requests";
DROP POLICY "tenant_isolation_auth_session_consumed_refresh_tokens" ON "auth_session_consumed_refresh_tokens";
DROP POLICY "tenant_isolation_auth_sessions" ON "auth_sessions";
DROP POLICY "tenant_isolation_bid_details" ON "bid_details";
DROP POLICY "tenant_isolation_bid_outcome_events" ON "bid_outcome_events";
DROP POLICY "tenant_isolation_client_contacts" ON "client_contacts";
DROP POLICY "tenant_isolation_clients" ON "clients";
DROP POLICY "tenant_isolation_companies" ON "companies";
DROP POLICY "tenant_isolation_divisions" ON "divisions";
DROP POLICY "tenant_isolation_document_categories" ON "document_categories";
DROP POLICY "tenant_isolation_document_code_options" ON "document_code_options";
DROP POLICY "tenant_isolation_document_folders" ON "document_folders";
DROP POLICY "tenant_isolation_document_version_folder_locations" ON "document_version_folder_locations";
DROP POLICY "tenant_isolation_document_version_links" ON "document_version_links";
DROP POLICY "tenant_isolation_document_versions" ON "document_versions";
DROP POLICY "tenant_isolation_documents" ON "documents";
DROP POLICY "tenant_isolation_members" ON "members";
DROP POLICY "tenant_isolation_notification_recipients" ON "notification_recipients";
DROP POLICY "tenant_isolation_notifications" ON "notifications";
DROP POLICY "tenant_isolation_option_values" ON "option_values";
DROP POLICY "tenant_isolation_outbox_messages" ON "outbox_messages";
DROP POLICY "tenant_isolation_password_reset_tokens" ON "password_reset_tokens";
DROP POLICY "tenant_isolation_portal_configs" ON "portal_configs";
DROP POLICY "tenant_isolation_processed_events" ON "processed_events";
DROP POLICY "tenant_isolation_project_conversion_events" ON "project_conversion_events";
DROP POLICY "tenant_isolation_project_credential_deliveries" ON "project_credential_deliveries";
DROP POLICY "tenant_isolation_project_status_events" ON "project_status_events";
DROP POLICY "tenant_isolation_projects" ON "projects";
DROP POLICY "tenant_isolation_registry_documents" ON "registry_documents";
DROP POLICY "tenant_isolation_source_channels" ON "source_channels";
DROP POLICY "tenant_isolation_system_audit_logs" ON "system_audit_logs";
DROP POLICY "tenant_isolation_team_members" ON "team_members";
DROP POLICY "tenant_isolation_teams" ON "teams";
DROP POLICY "tenant_isolation_user_roles" ON "user_roles";
DROP POLICY "tenant_isolation_users" ON "users";
DROP POLICY "tenant_isolation_work_request_assignments" ON "work_request_assignments";
DROP POLICY "tenant_isolation_work_request_attachment_categories" ON "work_request_attachment_categories";
DROP POLICY "tenant_isolation_work_request_audit_attachments" ON "work_request_audit_attachments";
DROP POLICY "tenant_isolation_work_request_audit_logs" ON "work_request_audit_logs";
DROP POLICY "tenant_isolation_work_request_categories" ON "work_request_categories";
DROP POLICY "tenant_isolation_work_request_decisions" ON "work_request_decisions";
DROP POLICY "tenant_isolation_work_request_notes" ON "work_request_notes";
DROP POLICY "tenant_isolation_work_request_revision_documents" ON "work_request_revision_documents";
DROP POLICY "tenant_isolation_work_request_revision_requests" ON "work_request_revision_requests";
DROP POLICY "tenant_isolation_work_request_revision_submission_documents" ON "work_request_revision_submission_documents";
DROP POLICY "tenant_isolation_work_request_revision_submissions" ON "work_request_revision_submissions";
DROP POLICY "tenant_isolation_work_requests" ON "work_requests";
DROP POLICY "tenant_isolation_workflow_action_role_permissions" ON "workflow_action_role_permissions";
DROP POLICY "tenant_isolation_workflow_info_requests" ON "workflow_info_requests";
DROP POLICY "tenant_isolation_workflow_info_responses" ON "workflow_info_responses";
DROP POLICY "tenant_isolation_workflow_transitions" ON "workflow_transitions";

ALTER TABLE "tenants" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "actor_profiles" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "archived_bid_review_requests" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "auth_session_consumed_refresh_tokens" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "auth_sessions" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "bid_details" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "bid_outcome_events" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "client_contacts" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "clients" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "companies" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "divisions" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "document_categories" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "document_code_options" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "document_folders" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "document_version_folder_locations" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "document_version_links" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "document_versions" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "documents" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "members" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_recipients" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "option_values" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "outbox_messages" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "password_reset_tokens" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "portal_configs" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "processed_events" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "project_conversion_events" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "project_credential_deliveries" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "project_status_events" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "projects" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "registry_documents" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "source_channels" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "system_audit_logs" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "team_members" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "teams" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "user_roles" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "users" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "work_request_assignments" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "work_request_attachment_categories" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "work_request_audit_attachments" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "work_request_audit_logs" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "work_request_categories" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "work_request_decisions" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "work_request_notes" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "work_request_revision_documents" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "work_request_revision_requests" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "work_request_revision_submission_documents" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "work_request_revision_submissions" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "work_requests" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "workflow_action_role_permissions" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "workflow_info_requests" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "workflow_info_responses" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "workflow_transitions" DISABLE ROW LEVEL SECURITY;

COMMIT;


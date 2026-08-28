-- Create the system-wide tenant registry.

CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

INSERT INTO "tenants" ("id", "name", "slug") VALUES ('00000000-0000-4000-8000-000000000001', 'Default Organization', 'default');


-- Add tenant ownership and backfill every existing domain record.

ALTER TABLE "users" ADD COLUMN "tenant_id" UUID;

UPDATE "users" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "users" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "user_roles" ADD COLUMN "tenant_id" UUID;

UPDATE "user_roles" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "user_roles" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "actor_profiles" ADD COLUMN "tenant_id" UUID;

UPDATE "actor_profiles" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "actor_profiles" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "auth_sessions" ADD COLUMN "tenant_id" UUID;

UPDATE "auth_sessions" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "auth_sessions" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "password_reset_tokens" ADD COLUMN "tenant_id" UUID;

UPDATE "password_reset_tokens" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "password_reset_tokens" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "companies" ADD COLUMN "tenant_id" UUID;

UPDATE "companies" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "companies" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "divisions" ADD COLUMN "tenant_id" UUID;

UPDATE "divisions" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "divisions" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "members" ADD COLUMN "tenant_id" UUID;

UPDATE "members" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "members" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "teams" ADD COLUMN "tenant_id" UUID;

UPDATE "teams" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "teams" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "team_members" ADD COLUMN "tenant_id" UUID;

UPDATE "team_members" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "team_members" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "clients" ADD COLUMN "tenant_id" UUID;

UPDATE "clients" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "clients" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "client_contacts" ADD COLUMN "tenant_id" UUID;

UPDATE "client_contacts" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "client_contacts" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "portal_configs" ADD COLUMN "tenant_id" UUID;

UPDATE "portal_configs" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "portal_configs" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "option_values" ADD COLUMN "tenant_id" UUID;

UPDATE "option_values" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "option_values" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "document_code_options" ADD COLUMN "tenant_id" UUID;

UPDATE "document_code_options" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "document_code_options" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "source_channels" ADD COLUMN "tenant_id" UUID;

UPDATE "source_channels" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "source_channels" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "projects" ADD COLUMN "tenant_id" UUID;

UPDATE "projects" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "projects" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "project_status_events" ADD COLUMN "tenant_id" UUID;

UPDATE "project_status_events" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "project_status_events" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "bid_details" ADD COLUMN "tenant_id" UUID;

UPDATE "bid_details" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "bid_details" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "project_credential_deliveries" ADD COLUMN "tenant_id" UUID;

UPDATE "project_credential_deliveries" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "project_credential_deliveries" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "bid_outcome_events" ADD COLUMN "tenant_id" UUID;

UPDATE "bid_outcome_events" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "bid_outcome_events" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "project_conversion_events" ADD COLUMN "tenant_id" UUID;

UPDATE "project_conversion_events" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "project_conversion_events" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "archived_bid_review_requests" ADD COLUMN "tenant_id" UUID;

UPDATE "archived_bid_review_requests" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "archived_bid_review_requests" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "document_categories" ADD COLUMN "tenant_id" UUID;

UPDATE "document_categories" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "document_categories" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "documents" ADD COLUMN "tenant_id" UUID;

UPDATE "documents" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "documents" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "document_versions" ADD COLUMN "tenant_id" UUID;

UPDATE "document_versions" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "document_versions" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "document_folders" ADD COLUMN "tenant_id" UUID;

UPDATE "document_folders" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "document_folders" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "document_version_folder_locations" ADD COLUMN "tenant_id" UUID;

UPDATE "document_version_folder_locations" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "document_version_folder_locations" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "document_version_links" ADD COLUMN "tenant_id" UUID;

UPDATE "document_version_links" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "document_version_links" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "work_request_categories" ADD COLUMN "tenant_id" UUID;

UPDATE "work_request_categories" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "work_request_categories" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "work_request_attachment_categories" ADD COLUMN "tenant_id" UUID;

UPDATE "work_request_attachment_categories" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "work_request_attachment_categories" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "workflow_transitions" ADD COLUMN "tenant_id" UUID;

UPDATE "workflow_transitions" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "workflow_transitions" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "workflow_action_role_permissions" ADD COLUMN "tenant_id" UUID;

UPDATE "workflow_action_role_permissions" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "workflow_action_role_permissions" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "work_requests" ADD COLUMN "tenant_id" UUID;

UPDATE "work_requests" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "work_requests" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "work_request_assignments" ADD COLUMN "tenant_id" UUID;

UPDATE "work_request_assignments" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "work_request_assignments" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "work_request_audit_logs" ADD COLUMN "tenant_id" UUID;

UPDATE "work_request_audit_logs" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "work_request_audit_logs" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "work_request_notes" ADD COLUMN "tenant_id" UUID;

UPDATE "work_request_notes" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "work_request_notes" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "work_request_audit_attachments" ADD COLUMN "tenant_id" UUID;

UPDATE "work_request_audit_attachments" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "work_request_audit_attachments" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "workflow_info_requests" ADD COLUMN "tenant_id" UUID;

UPDATE "workflow_info_requests" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "workflow_info_requests" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "workflow_info_responses" ADD COLUMN "tenant_id" UUID;

UPDATE "workflow_info_responses" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "workflow_info_responses" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "work_request_revision_requests" ADD COLUMN "tenant_id" UUID;

UPDATE "work_request_revision_requests" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "work_request_revision_requests" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "work_request_revision_documents" ADD COLUMN "tenant_id" UUID;

UPDATE "work_request_revision_documents" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "work_request_revision_documents" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "work_request_revision_submissions" ADD COLUMN "tenant_id" UUID;

UPDATE "work_request_revision_submissions" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "work_request_revision_submissions" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "work_request_revision_submission_documents" ADD COLUMN "tenant_id" UUID;

UPDATE "work_request_revision_submission_documents" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "work_request_revision_submission_documents" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "work_request_decisions" ADD COLUMN "tenant_id" UUID;

UPDATE "work_request_decisions" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "work_request_decisions" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "registry_documents" ADD COLUMN "tenant_id" UUID;

UPDATE "registry_documents" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "registry_documents" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "notifications" ADD COLUMN "tenant_id" UUID;

UPDATE "notifications" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "notifications" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "notification_recipients" ADD COLUMN "tenant_id" UUID;

UPDATE "notification_recipients" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "notification_recipients" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "system_audit_logs" ADD COLUMN "tenant_id" UUID;

UPDATE "system_audit_logs" SET "tenant_id" = '00000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "system_audit_logs" ALTER COLUMN "tenant_id" SET NOT NULL;


-- Replace tenant-local uniqueness constraints.

DROP INDEX "users_email_key";

CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");

DROP INDEX "password_reset_tokens_token_hash_key";

CREATE UNIQUE INDEX "password_reset_tokens_tenant_id_token_hash_key" ON "password_reset_tokens"("tenant_id", "token_hash");

DROP INDEX "companies_abbr_key";

CREATE UNIQUE INDEX "companies_tenant_id_abbr_key" ON "companies"("tenant_id", "abbr");

DROP INDEX "divisions_company_id_abbr_key";

CREATE UNIQUE INDEX "divisions_tenant_id_company_id_abbr_key" ON "divisions"("tenant_id", "company_id", "abbr");

DROP INDEX "members_email_key";

CREATE UNIQUE INDEX "members_tenant_id_email_key" ON "members"("tenant_id", "email");

DROP INDEX "teams_division_id_name_key";

CREATE UNIQUE INDEX "teams_tenant_id_division_id_name_key" ON "teams"("tenant_id", "division_id", "name");

DROP INDEX "client_contacts_client_id_email_key";

CREATE UNIQUE INDEX "client_contacts_tenant_id_client_id_email_key" ON "client_contacts"("tenant_id", "client_id", "email");

DROP INDEX "option_values_option_type_id_name_key";

CREATE UNIQUE INDEX "option_values_tenant_id_option_type_id_name_key" ON "option_values"("tenant_id", "option_type_id", "name");

DROP INDEX "document_code_options_document_group_code_key";

CREATE UNIQUE INDEX "document_code_options_tenant_id_document_group_code_key" ON "document_code_options"("tenant_id", "document_group", "code");

DROP INDEX "source_channels_name_key";

CREATE UNIQUE INDEX "source_channels_tenant_id_name_key" ON "source_channels"("tenant_id", "name");

DROP INDEX "projects_code_key";

CREATE UNIQUE INDEX "projects_tenant_id_code_key" ON "projects"("tenant_id", "code");

DROP INDEX "document_categories_name_key";

CREATE UNIQUE INDEX "document_categories_tenant_id_name_key" ON "document_categories"("tenant_id", "name");

DROP INDEX "document_versions_document_id_version_number_key";

CREATE UNIQUE INDEX "document_versions_tenant_id_document_id_version_number_key" ON "document_versions"("tenant_id", "document_id", "version_number");

DROP INDEX "document_folders_project_id_parent_folder_id_folder_name_key";

CREATE UNIQUE INDEX "document_folders_tenant_id_project_id_parent_folder_id_folder_n" ON "document_folders"("tenant_id", "project_id", "parent_folder_id", "folder_name");

DROP INDEX "document_version_folder_locations_document_version_id_folde_key";

CREATE UNIQUE INDEX "document_version_folder_locations_tenant_id_document_version_id" ON "document_version_folder_locations"("tenant_id", "document_version_id", "folder_id");

DROP INDEX "document_version_links_work_request_id_document_version_id__key";

CREATE UNIQUE INDEX "document_version_links_tenant_id_work_request_id_document_versi" ON "document_version_links"("tenant_id", "work_request_id", "document_version_id", "link_type");

DROP INDEX "work_request_categories_name_key";

CREATE UNIQUE INDEX "work_request_categories_tenant_id_name_key" ON "work_request_categories"("tenant_id", "name");

DROP INDEX "work_request_attachment_categories_name_key";

CREATE UNIQUE INDEX "work_request_attachment_categories_tenant_id_name_key" ON "work_request_attachment_categories"("tenant_id", "name");

DROP INDEX "workflow_action_role_permissions_action_id_role_id_key";

CREATE UNIQUE INDEX "workflow_action_role_permissions_tenant_id_action_id_role_id_ke" ON "workflow_action_role_permissions"("tenant_id", "action_id", "role_id");

DROP INDEX "work_requests_code_key";

CREATE UNIQUE INDEX "work_requests_tenant_id_code_key" ON "work_requests"("tenant_id", "code");

DROP INDEX "work_request_audit_attachments_audit_log_id_document_versio_key";

CREATE UNIQUE INDEX "work_request_audit_attachments_tenant_id_audit_log_id_document_" ON "work_request_audit_attachments"("tenant_id", "audit_log_id", "document_version_id");

DROP INDEX "work_request_revision_documents_revision_request_id_documen_key";

CREATE UNIQUE INDEX "work_request_revision_documents_tenant_id_revision_request_id_d" ON "work_request_revision_documents"("tenant_id", "revision_request_id", "document_version_id");

DROP INDEX "work_request_revision_submission_documents_revision_submiss_key";

CREATE UNIQUE INDEX "work_request_revision_submission_documents_tenant_id_revision_s" ON "work_request_revision_submission_documents"("tenant_id", "revision_submission_id", "document_version_id");

DROP INDEX "notification_recipients_notification_id_actor_id_key";

CREATE UNIQUE INDEX "notification_recipients_tenant_id_notification_id_actor_id_key" ON "notification_recipients"("tenant_id", "notification_id", "actor_id");


-- Add tenant lookup indexes and tenant foreign keys.

CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "user_roles_tenant_id_idx" ON "user_roles"("tenant_id");

ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "actor_profiles_tenant_id_idx" ON "actor_profiles"("tenant_id");

ALTER TABLE "actor_profiles" ADD CONSTRAINT "actor_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "auth_sessions_tenant_id_idx" ON "auth_sessions"("tenant_id");

ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "password_reset_tokens_tenant_id_idx" ON "password_reset_tokens"("tenant_id");

ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "companies_tenant_id_idx" ON "companies"("tenant_id");

ALTER TABLE "companies" ADD CONSTRAINT "companies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "divisions_tenant_id_idx" ON "divisions"("tenant_id");

ALTER TABLE "divisions" ADD CONSTRAINT "divisions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "members_tenant_id_idx" ON "members"("tenant_id");

ALTER TABLE "members" ADD CONSTRAINT "members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "teams_tenant_id_idx" ON "teams"("tenant_id");

ALTER TABLE "teams" ADD CONSTRAINT "teams_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "team_members_tenant_id_idx" ON "team_members"("tenant_id");

ALTER TABLE "team_members" ADD CONSTRAINT "team_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "clients_tenant_id_idx" ON "clients"("tenant_id");

ALTER TABLE "clients" ADD CONSTRAINT "clients_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "client_contacts_tenant_id_idx" ON "client_contacts"("tenant_id");

ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "portal_configs_tenant_id_idx" ON "portal_configs"("tenant_id");

ALTER TABLE "portal_configs" ADD CONSTRAINT "portal_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "option_values_tenant_id_idx" ON "option_values"("tenant_id");

ALTER TABLE "option_values" ADD CONSTRAINT "option_values_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "document_code_options_tenant_id_idx" ON "document_code_options"("tenant_id");

ALTER TABLE "document_code_options" ADD CONSTRAINT "document_code_options_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "source_channels_tenant_id_idx" ON "source_channels"("tenant_id");

ALTER TABLE "source_channels" ADD CONSTRAINT "source_channels_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "projects_tenant_id_idx" ON "projects"("tenant_id");

ALTER TABLE "projects" ADD CONSTRAINT "projects_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "project_status_events_tenant_id_idx" ON "project_status_events"("tenant_id");

ALTER TABLE "project_status_events" ADD CONSTRAINT "project_status_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "bid_details_tenant_id_idx" ON "bid_details"("tenant_id");

ALTER TABLE "bid_details" ADD CONSTRAINT "bid_details_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "project_credential_deliveries_tenant_id_idx" ON "project_credential_deliveries"("tenant_id");

ALTER TABLE "project_credential_deliveries" ADD CONSTRAINT "project_credential_deliveries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "bid_outcome_events_tenant_id_idx" ON "bid_outcome_events"("tenant_id");

ALTER TABLE "bid_outcome_events" ADD CONSTRAINT "bid_outcome_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "project_conversion_events_tenant_id_idx" ON "project_conversion_events"("tenant_id");

ALTER TABLE "project_conversion_events" ADD CONSTRAINT "project_conversion_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "archived_bid_review_requests_tenant_id_idx" ON "archived_bid_review_requests"("tenant_id");

ALTER TABLE "archived_bid_review_requests" ADD CONSTRAINT "archived_bid_review_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "document_categories_tenant_id_idx" ON "document_categories"("tenant_id");

ALTER TABLE "document_categories" ADD CONSTRAINT "document_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "documents_tenant_id_idx" ON "documents"("tenant_id");

ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "document_versions_tenant_id_idx" ON "document_versions"("tenant_id");

ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "document_folders_tenant_id_idx" ON "document_folders"("tenant_id");

ALTER TABLE "document_folders" ADD CONSTRAINT "document_folders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "document_version_folder_locations_tenant_id_idx" ON "document_version_folder_locations"("tenant_id");

ALTER TABLE "document_version_folder_locations" ADD CONSTRAINT "document_version_folder_locations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "document_version_links_tenant_id_idx" ON "document_version_links"("tenant_id");

ALTER TABLE "document_version_links" ADD CONSTRAINT "document_version_links_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "work_request_categories_tenant_id_idx" ON "work_request_categories"("tenant_id");

ALTER TABLE "work_request_categories" ADD CONSTRAINT "work_request_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "work_request_attachment_categories_tenant_id_idx" ON "work_request_attachment_categories"("tenant_id");

ALTER TABLE "work_request_attachment_categories" ADD CONSTRAINT "work_request_attachment_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "workflow_transitions_tenant_id_idx" ON "workflow_transitions"("tenant_id");

ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "workflow_action_role_permissions_tenant_id_idx" ON "workflow_action_role_permissions"("tenant_id");

ALTER TABLE "workflow_action_role_permissions" ADD CONSTRAINT "workflow_action_role_permissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "work_requests_tenant_id_idx" ON "work_requests"("tenant_id");

ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "work_request_assignments_tenant_id_idx" ON "work_request_assignments"("tenant_id");

ALTER TABLE "work_request_assignments" ADD CONSTRAINT "work_request_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "work_request_audit_logs_tenant_id_idx" ON "work_request_audit_logs"("tenant_id");

ALTER TABLE "work_request_audit_logs" ADD CONSTRAINT "work_request_audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "work_request_notes_tenant_id_idx" ON "work_request_notes"("tenant_id");

ALTER TABLE "work_request_notes" ADD CONSTRAINT "work_request_notes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "work_request_audit_attachments_tenant_id_idx" ON "work_request_audit_attachments"("tenant_id");

ALTER TABLE "work_request_audit_attachments" ADD CONSTRAINT "work_request_audit_attachments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "workflow_info_requests_tenant_id_idx" ON "workflow_info_requests"("tenant_id");

ALTER TABLE "workflow_info_requests" ADD CONSTRAINT "workflow_info_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "workflow_info_responses_tenant_id_idx" ON "workflow_info_responses"("tenant_id");

ALTER TABLE "workflow_info_responses" ADD CONSTRAINT "workflow_info_responses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "work_request_revision_requests_tenant_id_idx" ON "work_request_revision_requests"("tenant_id");

ALTER TABLE "work_request_revision_requests" ADD CONSTRAINT "work_request_revision_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "work_request_revision_documents_tenant_id_idx" ON "work_request_revision_documents"("tenant_id");

ALTER TABLE "work_request_revision_documents" ADD CONSTRAINT "work_request_revision_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "work_request_revision_submissions_tenant_id_idx" ON "work_request_revision_submissions"("tenant_id");

ALTER TABLE "work_request_revision_submissions" ADD CONSTRAINT "work_request_revision_submissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "work_request_revision_submission_documents_tenant_id_idx" ON "work_request_revision_submission_documents"("tenant_id");

ALTER TABLE "work_request_revision_submission_documents" ADD CONSTRAINT "work_request_revision_submission_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "work_request_decisions_tenant_id_idx" ON "work_request_decisions"("tenant_id");

ALTER TABLE "work_request_decisions" ADD CONSTRAINT "work_request_decisions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "registry_documents_tenant_id_idx" ON "registry_documents"("tenant_id");

ALTER TABLE "registry_documents" ADD CONSTRAINT "registry_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "notifications_tenant_id_idx" ON "notifications"("tenant_id");

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "notification_recipients_tenant_id_idx" ON "notification_recipients"("tenant_id");

ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "system_audit_logs_tenant_id_idx" ON "system_audit_logs"("tenant_id");

ALTER TABLE "system_audit_logs" ADD CONSTRAINT "system_audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


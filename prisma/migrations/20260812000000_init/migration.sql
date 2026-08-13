-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "actor_role_code" AS ENUM ('system_admin', 'prime_consultant', 'ccr_coordinator', 'division_lead', 'division_member', 'tms_manager', 'tms_drawing', 'tms_checking', 'tms_approval', 'client_owner');

-- CreateEnum
CREATE TYPE "workspace_type_code" AS ENUM ('BID', 'PROJECT');

-- CreateEnum
CREATE TYPE "project_status_code" AS ENUM ('DRAFT', 'BIDDING', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "work_request_status_code" AS ENUM ('CREATED', 'DIVISION_NOTIFIED', 'INFO_REQUESTED_FROM_MARKETING', 'INFO_REQUESTED_FROM_CLIENT', 'CLIENT_INFO_PROVIDED', 'MARKETING_INFO_PROVIDED', 'LEADER_ASSIGNED', 'MEMBER_REVIEW', 'MEMBER_INFO_REQUESTED', 'PM_LEAD_RESPONDED', 'PM_MEMBER_SUBMITTED', 'PM_REWORK_REQUESTED', 'FORWARDED_TO_TMS', 'ENGINEERING_REVISION_REQUESTED', 'TMS_MEMBER_INFO_REQUESTED', 'TMS_ASSIGNED', 'DRAWING_IN_PROGRESS', 'CHECKING_REVIEW', 'APPROVAL_REVIEW', 'ENGINEERING_LEAD_REVIEW', 'FINAL_SUBMITTED_TO_MARKETING', 'FINAL_SUBMITTED_TO_CLIENT', 'CLIENT_REVISION_REQUESTED', 'RETURNED_TO_DIVISION', 'DIVISION_MEMBER_APPROVED', 'DIVISION_MANAGER_APPROVED', 'FORWARDED_TO_CCR', 'HML_LISTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "workflow_action_code" AS ENUM ('ADD_COMPANY', 'ADD_DIVISION', 'ADD_TEAM', 'ADD_MEMBER', 'ADD_PROJECT', 'ADD_BID', 'ADD_CLIENT_DOCUMENT', 'ADD_WORK_REQUEST_DOCUMENT', 'ADD_WORK_REQUEST', 'ADD_WORK_REQUEST_NOTE', 'REQUEST_WORKFLOW_INFO', 'RESPOND_WORKFLOW_INFO', 'REQUEST_INFO_FROM_MARKETING', 'MARKETING_RETURN_TO_PM', 'MARKETING_ESCALATE_TO_CLIENT', 'CLIENT_PROVIDE_INFO', 'MEMBER_REQUEST_INFO', 'PM_LEAD_RESPOND_TO_MEMBER', 'PM_MEMBER_SUBMIT', 'PM_RETURN_TO_MEMBER', 'ASSIGN_LEADER', 'ASSIGN_MEMBER', 'FORWARD_TO_TMS', 'ASSIGN_TMS_CHAIN', 'SUBMIT_DRAWING', 'REVIEW_CHECKING_APPROVE', 'REVIEW_CHECKING_REJECT', 'REVIEW_APPROVAL_APPROVE', 'REVIEW_APPROVAL_REJECT', 'ENGINEERING_REQUEST_PM_REVISION', 'TMS_MEMBER_REQUEST_LEAD', 'TMS_LEAD_RESPOND_TO_MEMBER', 'ENGINEERING_SUBMIT_TO_MARKETING', 'MARKETING_SUBMIT_TO_CLIENT', 'MARKETING_REQUEST_ENGINEERING_REVISION', 'MARKETING_ROUTE_CLIENT_REVISION_TO_TMS', 'MARKETING_SUBMIT_CLIENT_REVISION', 'ENGINEERING_REQUEST_TMS_REVISION', 'CLIENT_REQUEST_REVISION', 'MARKETING_SEND_CLIENT_REVISION_TO_PM', 'CLIENT_ACCEPT_FINAL', 'CLIENT_REJECT_FINAL', 'ORIGIN_MEMBER_APPROVE', 'ORIGIN_MEMBER_REJECT', 'ORIGIN_MANAGER_APPROVE', 'FORWARD_TO_CCR', 'SEND_BACKWARD', 'LIST_FINAL_DOCUMENT', 'DECIDE_BID_OUTCOME', 'REQUEST_ARCHIVED_BID_REVIEW', 'UPDATE_SETTINGS');

-- CreateEnum
CREATE TYPE "work_priority_code" AS ENUM ('High', 'Medium', 'Low');

-- CreateEnum
CREATE TYPE "attachment_source_type_code" AS ENUM ('TEXT', 'FILE', 'TEXT_AND_FILE', 'METADATA');

-- CreateEnum
CREATE TYPE "attachment_file_group_code" AS ENUM ('PRIMARY', 'WORKFLOW');

-- CreateEnum
CREATE TYPE "document_group_code" AS ENUM ('MARKETING', 'ENGINEERING', 'CUSTOM');

-- CreateEnum
CREATE TYPE "info_request_status_code" AS ENUM ('OPEN', 'RESPONDED', 'CANCELLED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "revision_request_status_code" AS ENUM ('OPEN', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "decision_result_code" AS ENUM ('APPROVED', 'REJECTED', 'ACCEPTED', 'DECLINED', 'REVISION_REQUESTED', 'RETURNED');

-- CreateEnum
CREATE TYPE "bid_outcome_code" AS ENUM ('WIN', 'LOSE');

-- CreateEnum
CREATE TYPE "notification_kind_code" AS ENUM ('PROJECT', 'REQUEST', 'SYSTEM');

-- CreateEnum
CREATE TYPE "notification_target_view_code" AS ENUM ('focus', 'details');

-- CreateEnum
CREATE TYPE "document_link_type_code" AS ENUM ('INITIAL_UPLOAD', 'WORKFLOW_UPLOAD', 'FINAL_PACKAGE', 'CLIENT_REVISION', 'REVISION_RESPONSE', 'REGISTRY_LISTED');

-- CreateEnum
CREATE TYPE "folder_type_code" AS ENUM ('ROOT', 'CATEGORY', 'DATE', 'DATE_REVISION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "option_type_code" AS ENUM ('POL', 'POD', 'CARGO_CODE', 'VESSEL_CODE', 'PROJECT_INFO_CATEGORY', 'WORK_REQUEST_TYPE', 'DOCUMENT_CATEGORY', 'ATTACHMENT_CATEGORY');

-- CreateEnum
CREATE TYPE "assignment_type_code" AS ENUM ('PM_LEADER', 'PM_MEMBER', 'TMS_MANAGER', 'TMS_DRAWING', 'TMS_CHECKING', 'TMS_APPROVAL');

-- CreateEnum
CREATE TYPE "audit_entity_type_code" AS ENUM ('PROJECT', 'WORK_REQUEST', 'DOCUMENT', 'TEAM', 'MEMBER', 'CLIENT', 'COMPANY', 'SETTING', 'NOTIFICATION');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "full_name" VARCHAR(160) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255),
    "avatar_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "code" "actor_role_code" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "is_system_role" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_by_user_id" UUID,
    "assigned_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(6),

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actor_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "role_id" UUID NOT NULL,
    "member_id" UUID,
    "client_contact_id" UUID,
    "label" VARCHAR(180) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "actor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" VARCHAR(255) NOT NULL,
    "ip_address" VARCHAR(80),
    "user_agent" TEXT,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "revoked_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "used_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_types" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,

    CONSTRAINT "company_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "abbr" VARCHAR(30) NOT NULL,
    "company_type_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "division_types" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,

    CONSTRAINT "division_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "divisions" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "abbr" VARCHAR(30) NOT NULL,
    "division_type_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "divisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "company_id" UUID NOT NULL,
    "division_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role_title" VARCHAR(140) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "division_id" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "lead_member_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "team_role" VARCHAR(100),
    "joined_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(6),

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "company_id" UUID,
    "name" VARCHAR(180) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_contacts" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "client_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "designation" VARCHAR(140),
    "phone" VARCHAR(60),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_configs" (
    "id" UUID NOT NULL,
    "portal_name" VARCHAR(180) NOT NULL,
    "default_timezone" VARCHAR(80) NOT NULL DEFAULT 'Asia/Dhaka',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "option_types" (
    "id" UUID NOT NULL,
    "code" "option_type_code" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "option_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "option_values" (
    "id" UUID NOT NULL,
    "option_type_id" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "code" VARCHAR(40),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "option_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_code_options" (
    "id" UUID NOT NULL,
    "document_group" "document_group_code" NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_code_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_types" (
    "id" UUID NOT NULL,
    "code" "workspace_type_code" NOT NULL,
    "name" VARCHAR(80) NOT NULL,

    CONSTRAINT "workspace_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_statuses" (
    "id" UUID NOT NULL,
    "code" "project_status_code" NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_terminal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "project_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_channels" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "source_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(220) NOT NULL,
    "workspace_type_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "origin_division_id" UUID NOT NULL,
    "source_channel_id" UUID,
    "created_by_actor_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_status_events" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "from_status_id" UUID,
    "to_status_id" UUID NOT NULL,
    "changed_by_actor_id" UUID,
    "reason" TEXT,
    "occurred_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bid_details" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "bidding_number" VARCHAR(60) NOT NULL,
    "project_name" VARCHAR(220) NOT NULL,
    "pol_option_id" UUID,
    "pod_option_id" UUID,
    "project_code" VARCHAR(40) NOT NULL,
    "cargo_name" VARCHAR(180) NOT NULL,
    "cargo_code_option_id" UUID,
    "vessel_name" VARCHAR(180) NOT NULL,
    "vessel_code_option_id" UUID,
    "shipment_number" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bid_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_credential_deliveries" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "client_contact_id" UUID,
    "sent_by_actor_id" UUID,
    "sent_to_email" VARCHAR(255) NOT NULL,
    "sent_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivery_status" VARCHAR(80) NOT NULL DEFAULT 'SENT',
    "failure_reason" TEXT,

    CONSTRAINT "project_credential_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bid_outcome_events" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "outcome" "bid_outcome_code" NOT NULL,
    "previous_project_code" VARCHAR(60),
    "new_project_code" VARCHAR(60),
    "decided_by_actor_id" UUID NOT NULL,
    "decided_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "bid_outcome_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_conversion_events" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "from_workspace_type_id" UUID NOT NULL,
    "to_workspace_type_id" UUID NOT NULL,
    "from_code" VARCHAR(60) NOT NULL,
    "to_code" VARCHAR(60) NOT NULL,
    "converted_by_actor_id" UUID NOT NULL,
    "converted_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "project_conversion_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "archived_bid_review_requests" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "requested_by_actor_id" UUID NOT NULL,
    "note" TEXT,
    "requested_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restored_work_request_id" UUID,

    CONSTRAINT "archived_bid_review_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "code" VARCHAR(40),
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "document_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachment_source_types" (
    "id" UUID NOT NULL,
    "code" "attachment_source_type_code" NOT NULL,
    "name" VARCHAR(80) NOT NULL,

    CONSTRAINT "attachment_source_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachment_file_groups" (
    "id" UUID NOT NULL,
    "code" "attachment_file_group_code" NOT NULL,
    "name" VARCHAR(80) NOT NULL,

    CONSTRAINT "attachment_file_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "work_request_id" UUID,
    "document_code_option_id" UUID,
    "document_category_id" UUID,
    "file_group_id" UUID NOT NULL,
    "title" VARCHAR(260) NOT NULL,
    "description" TEXT,
    "created_by_actor_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "version_key" VARCHAR(260),
    "source_type_id" UUID NOT NULL,
    "workflow_stage_status_id" UUID,
    "original_file_name" VARCHAR(260),
    "generated_file_name" VARCHAR(260),
    "file_extension" VARCHAR(20),
    "mime_type" VARCHAR(120),
    "file_size_bytes" BIGINT,
    "storage_bucket" VARCHAR(120),
    "storage_key" TEXT,
    "storage_url" TEXT,
    "text_content" TEXT,
    "note" TEXT,
    "is_revision_upload" BOOLEAN NOT NULL DEFAULT false,
    "revision_code" VARCHAR(20),
    "uploaded_by_actor_id" UUID NOT NULL,
    "uploaded_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_folders" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "parent_folder_id" UUID,
    "folder_type" "folder_type_code" NOT NULL,
    "folder_name" VARCHAR(260) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_version_folder_locations" (
    "id" UUID NOT NULL,
    "document_version_id" UUID NOT NULL,
    "folder_id" UUID NOT NULL,
    "folder_path" TEXT,
    "linked_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_version_folder_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_version_links" (
    "id" UUID NOT NULL,
    "work_request_id" UUID NOT NULL,
    "document_version_id" UUID NOT NULL,
    "link_type" "document_link_type_code" NOT NULL,
    "linked_by_actor_id" UUID,
    "linked_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_version_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_request_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "work_request_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_priorities" (
    "id" UUID NOT NULL,
    "code" "work_priority_code" NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "work_priorities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_request_attachment_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "work_request_attachment_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_statuses" (
    "id" UUID NOT NULL,
    "code" "work_request_status_code" NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_terminal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "workflow_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_action_definitions" (
    "id" UUID NOT NULL,
    "code" "workflow_action_code" NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "is_user_visible" BOOLEAN NOT NULL DEFAULT true,
    "is_revision_action" BOOLEAN NOT NULL DEFAULT false,
    "is_info_request_action" BOOLEAN NOT NULL DEFAULT false,
    "is_assignment_action" BOOLEAN NOT NULL DEFAULT false,
    "is_terminal_action" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_action_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_transitions" (
    "id" UUID NOT NULL,
    "action_id" UUID NOT NULL,
    "from_status_id" UUID,
    "to_status_id" UUID NOT NULL,
    "from_role_id" UUID,
    "target_role_id" UUID,
    "requires_assignment" BOOLEAN NOT NULL DEFAULT false,
    "is_backward_transition" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "workflow_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_action_role_permissions" (
    "id" UUID NOT NULL,
    "action_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_action_role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_requests" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "project_id" UUID NOT NULL,
    "title" VARCHAR(260) NOT NULL,
    "category_id" UUID NOT NULL,
    "priority_id" UUID NOT NULL,
    "attachment_category_id" UUID,
    "requested_document_title" VARCHAR(260),
    "notes" TEXT,
    "assigned_division_id" UUID NOT NULL,
    "origin_division_id" UUID NOT NULL,
    "created_by_actor_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "work_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_request_assignments" (
    "id" UUID NOT NULL,
    "work_request_id" UUID NOT NULL,
    "assignment_type" "assignment_type_code" NOT NULL,
    "member_id" UUID NOT NULL,
    "assigned_by_actor_id" UUID,
    "assigned_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassigned_at" TIMESTAMP(6),
    "note" TEXT,

    CONSTRAINT "work_request_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_request_audit_logs" (
    "id" UUID NOT NULL,
    "work_request_id" UUID NOT NULL,
    "action_id" UUID,
    "from_status_id" UUID,
    "to_status_id" UUID,
    "performed_by_actor_id" UUID,
    "performed_by_label" VARCHAR(180),
    "from_label" VARCHAR(180),
    "to_label" VARCHAR(180),
    "action_text" TEXT NOT NULL,
    "note" TEXT,
    "occurred_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_request_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_request_notes" (
    "id" UUID NOT NULL,
    "work_request_id" UUID NOT NULL,
    "audit_log_id" UUID,
    "note" TEXT NOT NULL,
    "created_by_actor_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_request_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_request_audit_attachments" (
    "id" UUID NOT NULL,
    "audit_log_id" UUID NOT NULL,
    "document_version_id" UUID NOT NULL,
    "attached_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_request_audit_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "info_request_statuses" (
    "id" UUID NOT NULL,
    "code" "info_request_status_code" NOT NULL,
    "name" VARCHAR(120) NOT NULL,

    CONSTRAINT "info_request_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_info_requests" (
    "id" UUID NOT NULL,
    "work_request_id" UUID NOT NULL,
    "parent_info_request_id" UUID,
    "requested_by_actor_id" UUID NOT NULL,
    "requested_by_member_id" UUID,
    "requested_by_role_id" UUID NOT NULL,
    "target_label" VARCHAR(180) NOT NULL,
    "target_role_id" UUID,
    "target_member_id" UUID,
    "target_client_contact_id" UUID,
    "status_at_request_id" UUID NOT NULL,
    "info_request_status_id" UUID NOT NULL,
    "note" TEXT,
    "requested_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(6),

    CONSTRAINT "workflow_info_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_info_responses" (
    "id" UUID NOT NULL,
    "info_request_id" UUID NOT NULL,
    "responded_by_actor_id" UUID NOT NULL,
    "response_note" TEXT,
    "responded_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_info_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revision_request_statuses" (
    "id" UUID NOT NULL,
    "code" "revision_request_status_code" NOT NULL,
    "name" VARCHAR(120) NOT NULL,

    CONSTRAINT "revision_request_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_request_revision_requests" (
    "id" UUID NOT NULL,
    "work_request_id" UUID NOT NULL,
    "source_action_id" UUID,
    "requested_by_actor_id" UUID NOT NULL,
    "requested_to_role_id" UUID,
    "requested_to_member_id" UUID,
    "status_at_request_id" UUID,
    "revision_status_id" UUID NOT NULL,
    "revision_code" VARCHAR(20),
    "note" TEXT,
    "requested_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(6),

    CONSTRAINT "work_request_revision_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_request_revision_documents" (
    "id" UUID NOT NULL,
    "revision_request_id" UUID NOT NULL,
    "document_version_id" UUID NOT NULL,
    "attached_by_actor_id" UUID,
    "attached_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_request_revision_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_request_revision_submissions" (
    "id" UUID NOT NULL,
    "revision_request_id" UUID NOT NULL,
    "submitted_by_actor_id" UUID NOT NULL,
    "submission_note" TEXT,
    "submitted_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_request_revision_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_request_revision_submission_documents" (
    "id" UUID NOT NULL,
    "revision_submission_id" UUID NOT NULL,
    "document_version_id" UUID NOT NULL,
    "attached_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_request_revision_submission_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_results" (
    "id" UUID NOT NULL,
    "code" "decision_result_code" NOT NULL,
    "name" VARCHAR(120) NOT NULL,

    CONSTRAINT "decision_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_request_decisions" (
    "id" UUID NOT NULL,
    "work_request_id" UUID NOT NULL,
    "action_id" UUID NOT NULL,
    "decision_result_id" UUID NOT NULL,
    "decided_by_actor_id" UUID NOT NULL,
    "from_status_id" UUID,
    "to_status_id" UUID,
    "note" TEXT,
    "decided_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_request_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registry_documents" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "work_request_id" UUID NOT NULL,
    "document_id" UUID,
    "listed_document_version_id" UUID,
    "listed_category_id" UUID,
    "listed_by_actor_id" UUID NOT NULL,
    "listed_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registry_note" TEXT,
    "removed_at" TIMESTAMP(6),
    "removed_by_actor_id" UUID,

    CONSTRAINT "registry_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "notification_kind" "notification_kind_code" NOT NULL,
    "project_id" UUID,
    "work_request_id" UUID,
    "audit_log_id" UUID,
    "title" VARCHAR(260) NOT NULL,
    "subtitle" VARCHAR(260),
    "role_message" VARCHAR(260),
    "target_view" "notification_target_view_code",
    "triggered_by_actor_id" UUID,
    "triggered_by_label" VARCHAR(180),
    "triggered_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(6),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_recipients" (
    "id" UUID NOT NULL,
    "notification_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "delivered_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(6),
    "opened_at" TIMESTAMP(6),
    "dismissed_at" TIMESTAMP(6),

    CONSTRAINT "notification_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_audit_logs" (
    "id" UUID NOT NULL,
    "entity_type" "audit_entity_type_code" NOT NULL,
    "entity_id" UUID NOT NULL,
    "action_id" UUID,
    "performed_by_actor_id" UUID,
    "summary" TEXT NOT NULL,
    "before_data" JSONB,
    "after_data" JSONB,
    "occurred_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE INDEX "user_roles_user_id_role_id_revoked_at_idx" ON "user_roles"("user_id", "role_id", "revoked_at");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");

-- CreateIndex
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_types_name_key" ON "company_types"("name");

-- CreateIndex
CREATE INDEX "companies_name_idx" ON "companies"("name");

-- CreateIndex
CREATE UNIQUE INDEX "companies_abbr_key" ON "companies"("abbr");

-- CreateIndex
CREATE UNIQUE INDEX "division_types_name_key" ON "division_types"("name");

-- CreateIndex
CREATE INDEX "divisions_company_id_name_idx" ON "divisions"("company_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "divisions_company_id_abbr_key" ON "divisions"("company_id", "abbr");

-- CreateIndex
CREATE UNIQUE INDEX "members_email_key" ON "members"("email");

-- CreateIndex
CREATE INDEX "members_company_id_idx" ON "members"("company_id");

-- CreateIndex
CREATE INDEX "members_division_id_idx" ON "members"("division_id");

-- CreateIndex
CREATE UNIQUE INDEX "teams_division_id_name_key" ON "teams"("division_id", "name");

-- CreateIndex
CREATE INDEX "team_members_team_id_member_id_left_at_idx" ON "team_members"("team_id", "member_id", "left_at");

-- CreateIndex
CREATE INDEX "clients_name_idx" ON "clients"("name");

-- CreateIndex
CREATE INDEX "client_contacts_email_idx" ON "client_contacts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "client_contacts_client_id_email_key" ON "client_contacts"("client_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "option_types_code_key" ON "option_types"("code");

-- CreateIndex
CREATE INDEX "option_values_option_type_id_code_idx" ON "option_values"("option_type_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "option_values_option_type_id_name_key" ON "option_values"("option_type_id", "name");

-- CreateIndex
CREATE INDEX "document_code_options_document_group_name_idx" ON "document_code_options"("document_group", "name");

-- CreateIndex
CREATE UNIQUE INDEX "document_code_options_document_group_code_key" ON "document_code_options"("document_group", "code");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_types_code_key" ON "workspace_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "project_statuses_code_key" ON "project_statuses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "source_channels_name_key" ON "source_channels"("name");

-- CreateIndex
CREATE UNIQUE INDEX "projects_code_key" ON "projects"("code");

-- CreateIndex
CREATE INDEX "projects_workspace_type_id_idx" ON "projects"("workspace_type_id");

-- CreateIndex
CREATE INDEX "projects_client_id_idx" ON "projects"("client_id");

-- CreateIndex
CREATE INDEX "projects_origin_division_id_idx" ON "projects"("origin_division_id");

-- CreateIndex
CREATE INDEX "projects_created_at_idx" ON "projects"("created_at");

-- CreateIndex
CREATE INDEX "project_status_events_project_id_occurred_at_idx" ON "project_status_events"("project_id", "occurred_at");

-- CreateIndex
CREATE INDEX "project_status_events_to_status_id_idx" ON "project_status_events"("to_status_id");

-- CreateIndex
CREATE UNIQUE INDEX "bid_details_project_id_key" ON "bid_details"("project_id");

-- CreateIndex
CREATE INDEX "bid_details_bidding_number_idx" ON "bid_details"("bidding_number");

-- CreateIndex
CREATE INDEX "bid_details_shipment_number_idx" ON "bid_details"("shipment_number");

-- CreateIndex
CREATE INDEX "project_credential_deliveries_project_id_idx" ON "project_credential_deliveries"("project_id");

-- CreateIndex
CREATE INDEX "project_credential_deliveries_sent_at_idx" ON "project_credential_deliveries"("sent_at");

-- CreateIndex
CREATE INDEX "bid_outcome_events_project_id_decided_at_idx" ON "bid_outcome_events"("project_id", "decided_at");

-- CreateIndex
CREATE INDEX "bid_outcome_events_outcome_idx" ON "bid_outcome_events"("outcome");

-- CreateIndex
CREATE INDEX "project_conversion_events_project_id_converted_at_idx" ON "project_conversion_events"("project_id", "converted_at");

-- CreateIndex
CREATE INDEX "archived_bid_review_requests_project_id_requested_at_idx" ON "archived_bid_review_requests"("project_id", "requested_at");

-- CreateIndex
CREATE INDEX "document_categories_code_idx" ON "document_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "document_categories_name_key" ON "document_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "attachment_source_types_code_key" ON "attachment_source_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "attachment_file_groups_code_key" ON "attachment_file_groups"("code");

-- CreateIndex
CREATE INDEX "documents_project_id_idx" ON "documents"("project_id");

-- CreateIndex
CREATE INDEX "documents_work_request_id_idx" ON "documents"("work_request_id");

-- CreateIndex
CREATE INDEX "documents_document_code_option_id_idx" ON "documents"("document_code_option_id");

-- CreateIndex
CREATE INDEX "documents_document_category_id_idx" ON "documents"("document_category_id");

-- CreateIndex
CREATE INDEX "document_versions_document_id_uploaded_at_idx" ON "document_versions"("document_id", "uploaded_at");

-- CreateIndex
CREATE INDEX "document_versions_workflow_stage_status_id_idx" ON "document_versions"("workflow_stage_status_id");

-- CreateIndex
CREATE INDEX "document_versions_is_revision_upload_idx" ON "document_versions"("is_revision_upload");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_document_id_version_number_key" ON "document_versions"("document_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "document_folders_project_id_parent_folder_id_folder_name_key" ON "document_folders"("project_id", "parent_folder_id", "folder_name");

-- CreateIndex
CREATE UNIQUE INDEX "document_version_folder_locations_document_version_id_folde_key" ON "document_version_folder_locations"("document_version_id", "folder_id");

-- CreateIndex
CREATE INDEX "document_version_links_link_type_idx" ON "document_version_links"("link_type");

-- CreateIndex
CREATE UNIQUE INDEX "document_version_links_work_request_id_document_version_id__key" ON "document_version_links"("work_request_id", "document_version_id", "link_type");

-- CreateIndex
CREATE UNIQUE INDEX "work_request_categories_name_key" ON "work_request_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "work_priorities_code_key" ON "work_priorities"("code");

-- CreateIndex
CREATE UNIQUE INDEX "work_request_attachment_categories_name_key" ON "work_request_attachment_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_statuses_code_key" ON "workflow_statuses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_action_definitions_code_key" ON "workflow_action_definitions"("code");

-- CreateIndex
CREATE INDEX "workflow_transitions_action_id_from_status_id_to_status_id_idx" ON "workflow_transitions"("action_id", "from_status_id", "to_status_id");

-- CreateIndex
CREATE INDEX "workflow_transitions_from_role_id_idx" ON "workflow_transitions"("from_role_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_action_role_permissions_action_id_role_id_key" ON "workflow_action_role_permissions"("action_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_requests_code_key" ON "work_requests"("code");

-- CreateIndex
CREATE INDEX "work_requests_project_id_idx" ON "work_requests"("project_id");

-- CreateIndex
CREATE INDEX "work_requests_assigned_division_id_idx" ON "work_requests"("assigned_division_id");

-- CreateIndex
CREATE INDEX "work_requests_origin_division_id_idx" ON "work_requests"("origin_division_id");

-- CreateIndex
CREATE INDEX "work_requests_created_at_idx" ON "work_requests"("created_at");

-- CreateIndex
CREATE INDEX "work_request_assignments_work_request_id_assignment_type_un_idx" ON "work_request_assignments"("work_request_id", "assignment_type", "unassigned_at");

-- CreateIndex
CREATE INDEX "work_request_assignments_member_id_idx" ON "work_request_assignments"("member_id");

-- CreateIndex
CREATE INDEX "work_request_audit_logs_work_request_id_occurred_at_idx" ON "work_request_audit_logs"("work_request_id", "occurred_at");

-- CreateIndex
CREATE INDEX "work_request_audit_logs_action_id_idx" ON "work_request_audit_logs"("action_id");

-- CreateIndex
CREATE INDEX "work_request_audit_logs_to_status_id_idx" ON "work_request_audit_logs"("to_status_id");

-- CreateIndex
CREATE INDEX "work_request_audit_logs_performed_by_actor_id_idx" ON "work_request_audit_logs"("performed_by_actor_id");

-- CreateIndex
CREATE INDEX "work_request_notes_work_request_id_created_at_idx" ON "work_request_notes"("work_request_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "work_request_audit_attachments_audit_log_id_document_versio_key" ON "work_request_audit_attachments"("audit_log_id", "document_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "info_request_statuses_code_key" ON "info_request_statuses"("code");

-- CreateIndex
CREATE INDEX "workflow_info_requests_work_request_id_info_request_status__idx" ON "workflow_info_requests"("work_request_id", "info_request_status_id");

-- CreateIndex
CREATE INDEX "workflow_info_requests_target_role_id_idx" ON "workflow_info_requests"("target_role_id");

-- CreateIndex
CREATE INDEX "workflow_info_requests_target_member_id_idx" ON "workflow_info_requests"("target_member_id");

-- CreateIndex
CREATE INDEX "workflow_info_requests_target_client_contact_id_idx" ON "workflow_info_requests"("target_client_contact_id");

-- CreateIndex
CREATE INDEX "workflow_info_responses_info_request_id_idx" ON "workflow_info_responses"("info_request_id");

-- CreateIndex
CREATE INDEX "workflow_info_responses_responded_by_actor_id_idx" ON "workflow_info_responses"("responded_by_actor_id");

-- CreateIndex
CREATE UNIQUE INDEX "revision_request_statuses_code_key" ON "revision_request_statuses"("code");

-- CreateIndex
CREATE INDEX "work_request_revision_requests_work_request_id_requested_at_idx" ON "work_request_revision_requests"("work_request_id", "requested_at");

-- CreateIndex
CREATE INDEX "work_request_revision_requests_revision_status_id_idx" ON "work_request_revision_requests"("revision_status_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_request_revision_documents_revision_request_id_documen_key" ON "work_request_revision_documents"("revision_request_id", "document_version_id");

-- CreateIndex
CREATE INDEX "work_request_revision_submissions_revision_request_id_submi_idx" ON "work_request_revision_submissions"("revision_request_id", "submitted_at");

-- CreateIndex
CREATE UNIQUE INDEX "work_request_revision_submission_documents_revision_submiss_key" ON "work_request_revision_submission_documents"("revision_submission_id", "document_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "decision_results_code_key" ON "decision_results"("code");

-- CreateIndex
CREATE INDEX "work_request_decisions_work_request_id_decided_at_idx" ON "work_request_decisions"("work_request_id", "decided_at");

-- CreateIndex
CREATE INDEX "work_request_decisions_decision_result_id_idx" ON "work_request_decisions"("decision_result_id");

-- CreateIndex
CREATE INDEX "registry_documents_project_id_idx" ON "registry_documents"("project_id");

-- CreateIndex
CREATE INDEX "registry_documents_work_request_id_idx" ON "registry_documents"("work_request_id");

-- CreateIndex
CREATE INDEX "registry_documents_listed_at_idx" ON "registry_documents"("listed_at");

-- CreateIndex
CREATE INDEX "notifications_project_id_idx" ON "notifications"("project_id");

-- CreateIndex
CREATE INDEX "notifications_work_request_id_idx" ON "notifications"("work_request_id");

-- CreateIndex
CREATE INDEX "notifications_triggered_at_idx" ON "notifications"("triggered_at");

-- CreateIndex
CREATE INDEX "notification_recipients_actor_id_read_at_idx" ON "notification_recipients"("actor_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_recipients_notification_id_actor_id_key" ON "notification_recipients"("notification_id", "actor_id");

-- CreateIndex
CREATE INDEX "system_audit_logs_entity_type_entity_id_idx" ON "system_audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "system_audit_logs_performed_by_actor_id_idx" ON "system_audit_logs"("performed_by_actor_id");

-- CreateIndex
CREATE INDEX "system_audit_logs_occurred_at_idx" ON "system_audit_logs"("occurred_at");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actor_profiles" ADD CONSTRAINT "actor_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actor_profiles" ADD CONSTRAINT "actor_profiles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actor_profiles" ADD CONSTRAINT "actor_profiles_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actor_profiles" ADD CONSTRAINT "actor_profiles_client_contact_id_fkey" FOREIGN KEY ("client_contact_id") REFERENCES "client_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_company_type_id_fkey" FOREIGN KEY ("company_type_id") REFERENCES "company_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "divisions" ADD CONSTRAINT "divisions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "divisions" ADD CONSTRAINT "divisions_division_type_id_fkey" FOREIGN KEY ("division_type_id") REFERENCES "division_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "divisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "divisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_lead_member_id_fkey" FOREIGN KEY ("lead_member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "option_values" ADD CONSTRAINT "option_values_option_type_id_fkey" FOREIGN KEY ("option_type_id") REFERENCES "option_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_type_id_fkey" FOREIGN KEY ("workspace_type_id") REFERENCES "workspace_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_origin_division_id_fkey" FOREIGN KEY ("origin_division_id") REFERENCES "divisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_source_channel_id_fkey" FOREIGN KEY ("source_channel_id") REFERENCES "source_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_actor_id_fkey" FOREIGN KEY ("created_by_actor_id") REFERENCES "actor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_status_events" ADD CONSTRAINT "project_status_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_status_events" ADD CONSTRAINT "project_status_events_from_status_id_fkey" FOREIGN KEY ("from_status_id") REFERENCES "project_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_status_events" ADD CONSTRAINT "project_status_events_to_status_id_fkey" FOREIGN KEY ("to_status_id") REFERENCES "project_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_status_events" ADD CONSTRAINT "project_status_events_changed_by_actor_id_fkey" FOREIGN KEY ("changed_by_actor_id") REFERENCES "actor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bid_details" ADD CONSTRAINT "bid_details_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bid_details" ADD CONSTRAINT "bid_details_pol_option_id_fkey" FOREIGN KEY ("pol_option_id") REFERENCES "option_values"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bid_details" ADD CONSTRAINT "bid_details_pod_option_id_fkey" FOREIGN KEY ("pod_option_id") REFERENCES "option_values"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bid_details" ADD CONSTRAINT "bid_details_cargo_code_option_id_fkey" FOREIGN KEY ("cargo_code_option_id") REFERENCES "option_values"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bid_details" ADD CONSTRAINT "bid_details_vessel_code_option_id_fkey" FOREIGN KEY ("vessel_code_option_id") REFERENCES "option_values"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_credential_deliveries" ADD CONSTRAINT "project_credential_deliveries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_credential_deliveries" ADD CONSTRAINT "project_credential_deliveries_client_contact_id_fkey" FOREIGN KEY ("client_contact_id") REFERENCES "client_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_credential_deliveries" ADD CONSTRAINT "project_credential_deliveries_sent_by_actor_id_fkey" FOREIGN KEY ("sent_by_actor_id") REFERENCES "actor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bid_outcome_events" ADD CONSTRAINT "bid_outcome_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bid_outcome_events" ADD CONSTRAINT "bid_outcome_events_decided_by_actor_id_fkey" FOREIGN KEY ("decided_by_actor_id") REFERENCES "actor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_conversion_events" ADD CONSTRAINT "project_conversion_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_conversion_events" ADD CONSTRAINT "project_conversion_events_from_workspace_type_id_fkey" FOREIGN KEY ("from_workspace_type_id") REFERENCES "workspace_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_conversion_events" ADD CONSTRAINT "project_conversion_events_to_workspace_type_id_fkey" FOREIGN KEY ("to_workspace_type_id") REFERENCES "workspace_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_conversion_events" ADD CONSTRAINT "project_conversion_events_converted_by_actor_id_fkey" FOREIGN KEY ("converted_by_actor_id") REFERENCES "actor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "archived_bid_review_requests" ADD CONSTRAINT "archived_bid_review_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "archived_bid_review_requests" ADD CONSTRAINT "archived_bid_review_requests_requested_by_actor_id_fkey" FOREIGN KEY ("requested_by_actor_id") REFERENCES "actor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "archived_bid_review_requests" ADD CONSTRAINT "archived_bid_review_requests_restored_work_request_id_fkey" FOREIGN KEY ("restored_work_request_id") REFERENCES "work_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_work_request_id_fkey" FOREIGN KEY ("work_request_id") REFERENCES "work_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_document_code_option_id_fkey" FOREIGN KEY ("document_code_option_id") REFERENCES "document_code_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_document_category_id_fkey" FOREIGN KEY ("document_category_id") REFERENCES "document_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_file_group_id_fkey" FOREIGN KEY ("file_group_id") REFERENCES "attachment_file_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_actor_id_fkey" FOREIGN KEY ("created_by_actor_id") REFERENCES "actor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_source_type_id_fkey" FOREIGN KEY ("source_type_id") REFERENCES "attachment_source_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_workflow_stage_status_id_fkey" FOREIGN KEY ("workflow_stage_status_id") REFERENCES "workflow_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_uploaded_by_actor_id_fkey" FOREIGN KEY ("uploaded_by_actor_id") REFERENCES "actor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_folders" ADD CONSTRAINT "document_folders_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_folders" ADD CONSTRAINT "document_folders_parent_folder_id_fkey" FOREIGN KEY ("parent_folder_id") REFERENCES "document_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_version_folder_locations" ADD CONSTRAINT "document_version_folder_locations_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_version_folder_locations" ADD CONSTRAINT "document_version_folder_locations_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "document_folders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_version_links" ADD CONSTRAINT "document_version_links_work_request_id_fkey" FOREIGN KEY ("work_request_id") REFERENCES "work_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_version_links" ADD CONSTRAINT "document_version_links_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_version_links" ADD CONSTRAINT "document_version_links_linked_by_actor_id_fkey" FOREIGN KEY ("linked_by_actor_id") REFERENCES "actor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "workflow_action_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_from_status_id_fkey" FOREIGN KEY ("from_status_id") REFERENCES "workflow_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_to_status_id_fkey" FOREIGN KEY ("to_status_id") REFERENCES "workflow_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_from_role_id_fkey" FOREIGN KEY ("from_role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_target_role_id_fkey" FOREIGN KEY ("target_role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_action_role_permissions" ADD CONSTRAINT "workflow_action_role_permissions_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "workflow_action_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_action_role_permissions" ADD CONSTRAINT "workflow_action_role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "work_request_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_priority_id_fkey" FOREIGN KEY ("priority_id") REFERENCES "work_priorities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_attachment_category_id_fkey" FOREIGN KEY ("attachment_category_id") REFERENCES "work_request_attachment_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_assigned_division_id_fkey" FOREIGN KEY ("assigned_division_id") REFERENCES "divisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_origin_division_id_fkey" FOREIGN KEY ("origin_division_id") REFERENCES "divisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_created_by_actor_id_fkey" FOREIGN KEY ("created_by_actor_id") REFERENCES "actor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_request_assignments" ADD CONSTRAINT "work_request_assignments_work_request_id_fkey" FOREIGN KEY ("work_request_id") REFERENCES "work_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_request_assignments" ADD CONSTRAINT "work_request_assignments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_request_assignments" ADD CONSTRAINT "work_request_assignments_assigned_by_actor_id_fkey" FOREIGN KEY ("assigned_by_actor_id") REFERENCES "actor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_request_audit_logs" ADD CONSTRAINT "work_request_audit_logs_work_request_id_fkey" FOREIGN KEY ("work_request_id") REFERENCES "work_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_request_audit_logs" ADD CONSTRAINT "work_request_audit_logs_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "workflow_action_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_request_audit_logs" ADD CONSTRAINT "work_request_audit_logs_from_status_id_fkey" FOREIGN KEY ("from_status_id") REFERENCES "workflow_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_request_audit_logs" ADD CONSTRAINT "work_request_audit_logs_to_status_id_fkey" FOREIGN KEY ("to_status_id") REFERENCES "workflow_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_request_audit_logs" ADD CONSTRAINT "work_request_audit_logs_performed_by_actor_id_fkey" FOREIGN KEY ("performed_by_actor_id") REFERENCES "actor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_request_notes" ADD CONSTRAINT "work_request_notes_work_request_id_fkey" FOREIGN KEY ("work_request_id") REFERENCES "work_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_request_notes" ADD CONSTRAINT "work_request_notes_audit_log_id_fkey" FOREIGN KEY ("audit_log_id") REFERENCES "work_request_audit_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_request_notes" ADD CONSTRAINT "work_request_notes_created_by_actor_id_fkey" FOREIGN KEY ("created_by_actor_id") REFERENCES "actor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_request_audit_attachments" ADD CONSTRAINT "work_request_audit_attachments_audit_log_id_fkey" FOREIGN KEY ("audit_log_id") REFERENCES "work_request_audit_logs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_request_audit_attachments" ADD CONSTRAINT "work_request_audit_attachments_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_info_requests" ADD CONSTRAINT "workflow_info_requests_work_request_id_fkey" FOREIGN KEY ("work_request_id") REFERENCES "work_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_info_requests" ADD CONSTRAINT "workflow_info_requests_parent_info_request_id_fkey" FOREIGN KEY ("parent_info_request_id") REFERENCES "workflow_info_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_info_requests" ADD CONSTRAINT "workflow_info_requests_requested_by_actor_id_fkey" FOREIGN KEY ("requested_by_actor_id") REFERENCES "actor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_info_requests" ADD CONSTRAINT "workflow_info_requests_requested_by_member_id_fkey" FOREIGN KEY ("requested_by_member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_info_requests" ADD CONSTRAINT "workflow_info_requests_requested_by_role_id_fkey" FOREIGN KEY ("requested_by_role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_info_requests" ADD CONSTRAINT "workflow_info_requests_target_role_id_fkey" FOREIGN KEY ("target_role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_info_requests" ADD CONSTRAINT "workflow_info_requests_target_member_id_fkey" FOREIGN KEY ("target_member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_info_requests" ADD CONSTRAINT "workflow_info_requests_target_client_contact_id_fkey" FOREIGN KEY ("target_client_contact_id") REFERENCES "client_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_info_requests" ADD CONSTRAINT "workflow_info_requests_status_at_request_id_fkey" FOREIGN KEY ("status_at_request_id") REFERENCES "workflow_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_info_requests" ADD CONSTRAINT "workflow_info_requests_info_request_status_id_fkey" FOREIGN KEY ("info_request_status_id") REFERENCES "info_request_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_info_responses" ADD CONSTRAINT "workflow_info_responses_info_request_id_fkey" FOREIGN KEY ("info_request_id") REFERENCES "workflow_info_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_info_responses" ADD CONSTRAINT "workflow_info_responses_responded_by_actor_id_fkey" FOREIGN KEY ("responded_by_actor_id") REFERENCES "actor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_request_revision_requests" ADD CONSTRAINT "work_request_revision_requests_work_request_id_fkey" FOREIGN KEY ("work_request_id") REFERENCES "work_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_request_revision_requests" ADD CONSTRAINT "work_request_revision_requests_source_action_id_fkey" FOREIGN KEY ("source_action_id") REFERENCES "workflow_action_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_request_revision_requests" ADD CONSTRAINT "work_request_revision_requests_requested_by_actor_id_fkey" FOREIGN KEY ("requested_by_actor_id") REFERENCES "actor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_request_revision_requests" ADD CONSTRAINT "work_request_revision_requests_requested_to_role_id_fkey" FOREIGN KEY ("requested_to_role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_request_revision_requests" ADD CONSTRAINT "work_request_revision_requests_requested_to_member_id_fkey" FOREIGN KEY ("requested_to_member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_request_revision_requests" ADD CONSTRAINT "work_request_revision_requests_status_at_request_id_fkey" FOREIGN KEY ("status_at_request_id") REFERENCES "workflow_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_request_revision_requests" ADD CONSTRAINT "work_request_revision_requests_revision_status_id_fkey" FOREIGN KEY ("revision_status_id") REFERENCES "revision_request_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_request_revision_documents" ADD CONSTRAINT "work_request_revision_documents_revision_request_id_fkey" FOREIGN KEY ("revision_request_id") REFERENCES "work_request_revision_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_request_revision_documents" ADD CONSTRAINT "work_request_revision_documents_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_request_revision_documents" ADD CONSTRAINT "work_request_revision_documents_attached_by_actor_id_fkey" FOREIGN KEY ("attached_by_actor_id") REFERENCES "actor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_request_revision_submissions" ADD CONSTRAINT "work_request_revision_submissions_revision_request_id_fkey" FOREIGN KEY ("revision_request_id") REFERENCES "work_request_revision_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_request_revision_submissions" ADD CONSTRAINT "work_request_revision_submissions_submitted_by_actor_id_fkey" FOREIGN KEY ("submitted_by_actor_id") REFERENCES "actor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_request_revision_submission_documents" ADD CONSTRAINT "work_request_revision_submission_documents_revision_submis_fkey" FOREIGN KEY ("revision_submission_id") REFERENCES "work_request_revision_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_request_revision_submission_documents" ADD CONSTRAINT "work_request_revision_submission_documents_document_versio_fkey" FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_request_decisions" ADD CONSTRAINT "work_request_decisions_work_request_id_fkey" FOREIGN KEY ("work_request_id") REFERENCES "work_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_request_decisions" ADD CONSTRAINT "work_request_decisions_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "workflow_action_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_request_decisions" ADD CONSTRAINT "work_request_decisions_decision_result_id_fkey" FOREIGN KEY ("decision_result_id") REFERENCES "decision_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_request_decisions" ADD CONSTRAINT "work_request_decisions_decided_by_actor_id_fkey" FOREIGN KEY ("decided_by_actor_id") REFERENCES "actor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_request_decisions" ADD CONSTRAINT "work_request_decisions_from_status_id_fkey" FOREIGN KEY ("from_status_id") REFERENCES "workflow_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_request_decisions" ADD CONSTRAINT "work_request_decisions_to_status_id_fkey" FOREIGN KEY ("to_status_id") REFERENCES "workflow_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registry_documents" ADD CONSTRAINT "registry_documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registry_documents" ADD CONSTRAINT "registry_documents_work_request_id_fkey" FOREIGN KEY ("work_request_id") REFERENCES "work_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registry_documents" ADD CONSTRAINT "registry_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registry_documents" ADD CONSTRAINT "registry_documents_listed_document_version_id_fkey" FOREIGN KEY ("listed_document_version_id") REFERENCES "document_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registry_documents" ADD CONSTRAINT "registry_documents_listed_category_id_fkey" FOREIGN KEY ("listed_category_id") REFERENCES "document_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registry_documents" ADD CONSTRAINT "registry_documents_listed_by_actor_id_fkey" FOREIGN KEY ("listed_by_actor_id") REFERENCES "actor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registry_documents" ADD CONSTRAINT "registry_documents_removed_by_actor_id_fkey" FOREIGN KEY ("removed_by_actor_id") REFERENCES "actor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_work_request_id_fkey" FOREIGN KEY ("work_request_id") REFERENCES "work_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_audit_log_id_fkey" FOREIGN KEY ("audit_log_id") REFERENCES "work_request_audit_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_triggered_by_actor_id_fkey" FOREIGN KEY ("triggered_by_actor_id") REFERENCES "actor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "actor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_audit_logs" ADD CONSTRAINT "system_audit_logs_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "workflow_action_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_audit_logs" ADD CONSTRAINT "system_audit_logs_performed_by_actor_id_fkey" FOREIGN KEY ("performed_by_actor_id") REFERENCES "actor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

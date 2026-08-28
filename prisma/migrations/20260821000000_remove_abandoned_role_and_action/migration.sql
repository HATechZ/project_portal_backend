BEGIN;

-- Remove grants first. Any other historical reference intentionally makes this
-- migration fail rather than silently deleting or rewriting business history.
DELETE FROM "workflow_action_role_permissions"
WHERE "role_id" = (
  SELECT "id" FROM "roles" WHERE "code" = 'prime_consultant'
);

DELETE FROM "roles" WHERE "code" = 'prime_consultant';

DELETE FROM "workflow_action_role_permissions"
WHERE "action_id" = (
  SELECT "id"
  FROM "workflow_action_definitions"
  WHERE "code" = 'MARKETING_SEND_CLIENT_REVISION_TO_PM'
);

DELETE FROM "workflow_action_definitions"
WHERE "code" = 'MARKETING_SEND_CLIENT_REVISION_TO_PM';

ALTER TYPE "actor_role_code" RENAME TO "actor_role_code_old";
CREATE TYPE "actor_role_code" AS ENUM (
  'system_admin',
  'ccr_coordinator',
  'division_lead',
  'division_member',
  'tms_manager',
  'tms_drawing',
  'tms_checking',
  'tms_approval',
  'client_owner'
);
ALTER TABLE "roles"
  ALTER COLUMN "code" TYPE "actor_role_code"
  USING ("code"::text::"actor_role_code");
DROP TYPE "actor_role_code_old";

ALTER TYPE "workflow_action_code" RENAME TO "workflow_action_code_old";
CREATE TYPE "workflow_action_code" AS ENUM (
  'ADD_COMPANY',
  'ADD_DIVISION',
  'ADD_TEAM',
  'ADD_MEMBER',
  'ADD_PROJECT',
  'ADD_BID',
  'ADD_CLIENT_DOCUMENT',
  'ADD_WORK_REQUEST',
  'ADD_WORK_REQUEST_DOCUMENT',
  'ADD_WORK_REQUEST_NOTE',
  'REQUEST_WORKFLOW_INFO',
  'RESPOND_WORKFLOW_INFO',
  'REQUEST_INFO_FROM_MARKETING',
  'MARKETING_RETURN_TO_PM',
  'MARKETING_ESCALATE_TO_CLIENT',
  'CLIENT_PROVIDE_INFO',
  'MEMBER_REQUEST_INFO',
  'PM_LEAD_RESPOND_TO_MEMBER',
  'PM_MEMBER_SUBMIT',
  'PM_RETURN_TO_MEMBER',
  'ASSIGN_LEADER',
  'ASSIGN_MEMBER',
  'FORWARD_TO_TMS',
  'ASSIGN_TMS_CHAIN',
  'SUBMIT_DRAWING',
  'REVIEW_CHECKING_APPROVE',
  'REVIEW_CHECKING_REJECT',
  'REVIEW_APPROVAL_APPROVE',
  'REVIEW_APPROVAL_REJECT',
  'ENGINEERING_REQUEST_PM_REVISION',
  'TMS_MEMBER_REQUEST_LEAD',
  'TMS_LEAD_RESPOND_TO_MEMBER',
  'ENGINEERING_SUBMIT_TO_MARKETING',
  'MARKETING_SUBMIT_TO_CLIENT',
  'MARKETING_REQUEST_ENGINEERING_REVISION',
  'MARKETING_ROUTE_CLIENT_REVISION_TO_TMS',
  'MARKETING_SUBMIT_CLIENT_REVISION',
  'ENGINEERING_REQUEST_TMS_REVISION',
  'CLIENT_REQUEST_REVISION',
  'CLIENT_ACCEPT_FINAL',
  'CLIENT_REJECT_FINAL',
  'ORIGIN_MEMBER_APPROVE',
  'ORIGIN_MEMBER_REJECT',
  'ORIGIN_MANAGER_APPROVE',
  'FORWARD_TO_CCR',
  'SEND_BACKWARD',
  'LIST_FINAL_DOCUMENT',
  'REQUEST_ARCHIVED_BID_REVIEW',
  'DECIDE_BID_OUTCOME',
  'UPDATE_SETTINGS'
);
ALTER TABLE "workflow_action_definitions"
  ALTER COLUMN "code" TYPE "workflow_action_code"
  USING ("code"::text::"workflow_action_code");
DROP TYPE "workflow_action_code_old";

COMMIT;

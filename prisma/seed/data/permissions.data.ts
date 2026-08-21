import {
  ActorRoleCode,
  WorkflowActionCode,
} from '../../../src/generated/prisma/client';

const title = (code: string) =>
  code
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const revisionActions = new Set<WorkflowActionCode>([
  WorkflowActionCode.ENGINEERING_REQUEST_PM_REVISION,
  WorkflowActionCode.MARKETING_REQUEST_ENGINEERING_REVISION,
  WorkflowActionCode.MARKETING_ROUTE_CLIENT_REVISION_TO_TMS,
  WorkflowActionCode.MARKETING_SUBMIT_CLIENT_REVISION,
  WorkflowActionCode.ENGINEERING_REQUEST_TMS_REVISION,
  WorkflowActionCode.CLIENT_REQUEST_REVISION,
  WorkflowActionCode.SEND_BACKWARD,
]);
const infoActions = new Set<WorkflowActionCode>([
  WorkflowActionCode.REQUEST_WORKFLOW_INFO,
  WorkflowActionCode.RESPOND_WORKFLOW_INFO,
  WorkflowActionCode.REQUEST_INFO_FROM_MARKETING,
  WorkflowActionCode.MARKETING_RETURN_TO_PM,
  WorkflowActionCode.MARKETING_ESCALATE_TO_CLIENT,
  WorkflowActionCode.CLIENT_PROVIDE_INFO,
  WorkflowActionCode.MEMBER_REQUEST_INFO,
  WorkflowActionCode.PM_LEAD_RESPOND_TO_MEMBER,
  WorkflowActionCode.TMS_MEMBER_REQUEST_LEAD,
  WorkflowActionCode.TMS_LEAD_RESPOND_TO_MEMBER,
]);
const assignmentActions = new Set<WorkflowActionCode>([
  WorkflowActionCode.ASSIGN_LEADER,
  WorkflowActionCode.ASSIGN_MEMBER,
  WorkflowActionCode.ASSIGN_TMS_CHAIN,
]);
const terminalActions = new Set<WorkflowActionCode>([
  WorkflowActionCode.CLIENT_ACCEPT_FINAL,
  WorkflowActionCode.CLIENT_REJECT_FINAL,
  WorkflowActionCode.LIST_FINAL_DOCUMENT,
  WorkflowActionCode.DECIDE_BID_OUTCOME,
]);

export const permissions = Object.values(WorkflowActionCode).map(
  (code, index) => ({
    id: `60000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    code,
    name: title(code),
    description: `Allows the ${title(code).toLowerCase()} action.`,
    isUserVisible: true,
    isRevisionAction: revisionActions.has(code),
    isInfoRequestAction: infoActions.has(code),
    isAssignmentAction: assignmentActions.has(code),
    isTerminalAction: terminalActions.has(code),
  }),
);

const commonCreate = [
  WorkflowActionCode.ADD_WORK_REQUEST_DOCUMENT,
  WorkflowActionCode.ADD_WORK_REQUEST_NOTE,
  WorkflowActionCode.REQUEST_WORKFLOW_INFO,
  WorkflowActionCode.RESPOND_WORKFLOW_INFO,
];

const supervisorPermissions = Object.values(WorkflowActionCode).filter(
  (code) => code !== WorkflowActionCode.DECIDE_BID_OUTCOME,
);

export const rolePermissionCodes: Record<ActorRoleCode, WorkflowActionCode[]> =
  {
    system_admin: supervisorPermissions,
    ccr_coordinator: [
      WorkflowActionCode.ADD_PROJECT,
      WorkflowActionCode.ADD_BID,
      WorkflowActionCode.ADD_CLIENT_DOCUMENT,
      WorkflowActionCode.ADD_WORK_REQUEST,
      WorkflowActionCode.MARKETING_RETURN_TO_PM,
      WorkflowActionCode.MARKETING_ESCALATE_TO_CLIENT,
      WorkflowActionCode.MARKETING_SUBMIT_TO_CLIENT,
      WorkflowActionCode.MARKETING_REQUEST_ENGINEERING_REVISION,
      WorkflowActionCode.MARKETING_ROUTE_CLIENT_REVISION_TO_TMS,
      WorkflowActionCode.MARKETING_SUBMIT_CLIENT_REVISION,
      WorkflowActionCode.LIST_FINAL_DOCUMENT,
      WorkflowActionCode.REQUEST_ARCHIVED_BID_REVIEW,
      ...commonCreate,
    ],
    division_lead: [
      WorkflowActionCode.REQUEST_INFO_FROM_MARKETING,
      WorkflowActionCode.PM_LEAD_RESPOND_TO_MEMBER,
      WorkflowActionCode.PM_RETURN_TO_MEMBER,
      WorkflowActionCode.ASSIGN_MEMBER,
      WorkflowActionCode.FORWARD_TO_TMS,
      WorkflowActionCode.ORIGIN_MANAGER_APPROVE,
      WorkflowActionCode.FORWARD_TO_CCR,
      ...commonCreate,
    ],
    division_member: [
      WorkflowActionCode.MEMBER_REQUEST_INFO,
      WorkflowActionCode.PM_MEMBER_SUBMIT,
      WorkflowActionCode.ORIGIN_MEMBER_APPROVE,
      WorkflowActionCode.ORIGIN_MEMBER_REJECT,
      ...commonCreate,
    ],
    tms_manager: [
      WorkflowActionCode.ASSIGN_TMS_CHAIN,
      WorkflowActionCode.ENGINEERING_REQUEST_PM_REVISION,
      WorkflowActionCode.TMS_LEAD_RESPOND_TO_MEMBER,
      WorkflowActionCode.ENGINEERING_SUBMIT_TO_MARKETING,
      WorkflowActionCode.ENGINEERING_REQUEST_TMS_REVISION,
      ...commonCreate,
    ],
    tms_drawing: [
      WorkflowActionCode.SUBMIT_DRAWING,
      WorkflowActionCode.TMS_MEMBER_REQUEST_LEAD,
      ...commonCreate,
    ],
    tms_checking: [
      WorkflowActionCode.REVIEW_CHECKING_APPROVE,
      WorkflowActionCode.REVIEW_CHECKING_REJECT,
      WorkflowActionCode.TMS_MEMBER_REQUEST_LEAD,
      ...commonCreate,
    ],
    tms_approval: [
      WorkflowActionCode.REVIEW_APPROVAL_APPROVE,
      WorkflowActionCode.REVIEW_APPROVAL_REJECT,
      WorkflowActionCode.TMS_MEMBER_REQUEST_LEAD,
      ...commonCreate,
    ],
    client_owner: [
      WorkflowActionCode.ADD_CLIENT_DOCUMENT,
      WorkflowActionCode.REQUEST_WORKFLOW_INFO,
      WorkflowActionCode.RESPOND_WORKFLOW_INFO,
      WorkflowActionCode.CLIENT_PROVIDE_INFO,
      WorkflowActionCode.CLIENT_REQUEST_REVISION,
      WorkflowActionCode.CLIENT_ACCEPT_FINAL,
      WorkflowActionCode.CLIENT_REJECT_FINAL,
      WorkflowActionCode.DECIDE_BID_OUTCOME,
    ],
  };

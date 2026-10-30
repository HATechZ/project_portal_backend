import {
  CustomRoleScope,
  PermissionCode,
  WorkflowActionCode,
} from '../../generated/prisma/client';

/**
 * Legacy action codes identify workflow transitions only. This is the single
 * Work Request bridge from that compatibility label to final authorization.
 */
export const WORK_REQUEST_FINAL_PERMISSION_BY_ACTION = {
  [WorkflowActionCode.ADD_WORK_REQUEST]: PermissionCode.CREATE_WORK_REQUEST,
  [WorkflowActionCode.VIEW_WORK_REQUEST]: PermissionCode.VIEW_WORK_REQUEST,
  [WorkflowActionCode.UPDATE_WORK_REQUEST]: PermissionCode.UPDATE_WORK_REQUEST,
  [WorkflowActionCode.ADD_WORK_REQUEST_NOTE]:
    PermissionCode.CREATE_WORK_REQUEST_NOTE,
  [WorkflowActionCode.ADD_WORK_REQUEST_DOCUMENT]:
    PermissionCode.UPLOAD_DOCUMENT,
  [WorkflowActionCode.REQUEST_WORKFLOW_INFO]: PermissionCode.REQUEST_INFO,
  [WorkflowActionCode.RESPOND_WORKFLOW_INFO]:
    PermissionCode.RESPOND_TO_INFO_REQUEST,
  [WorkflowActionCode.WR_ASSIGN_DIVISION]:
    PermissionCode.ASSIGN_WORK_REQUEST_DIVISION,
  [WorkflowActionCode.WR_ASSIGN_TEAM]: PermissionCode.ASSIGN_WORK_REQUEST_TEAM,
  [WorkflowActionCode.WR_ASSIGN_MEMBER]:
    PermissionCode.ASSIGN_WORK_REQUEST_MEMBER,
  [WorkflowActionCode.WR_SUBMIT]: PermissionCode.SUBMIT_WORK_REQUEST,
  [WorkflowActionCode.WR_CHECKING_APPROVE]:
    PermissionCode.APPROVE_WORK_REQUEST_REVIEW,
  [WorkflowActionCode.WR_APPROVAL_APPROVE]:
    PermissionCode.APPROVE_WORK_REQUEST_REVIEW,
  [WorkflowActionCode.WR_REQUEST_REVISION]:
    PermissionCode.REQUEST_WORK_REQUEST_REVISION,
  [WorkflowActionCode.WR_FINAL_RELEASE]: PermissionCode.SUBMIT_FOR_REVIEW,
} as const satisfies Partial<Record<WorkflowActionCode, PermissionCode>>;

/** Work Request has no external-client action currently handled at runtime. */
export const DEFERRED_EXTERNAL_WORK_REQUEST_ACTIONS = [] as const;

/**
 * Frozen Phase 1 command catalogue for the route model. These are capability
 * mappings only: callers must also satisfy the exact scope, tenant, resource,
 * responsibility, and workflow checks captured by isRouteCommandAuthorized.
 */
export const WORK_REQUEST_ROUTE_COMMAND = {
  CREATE: 'CREATE',
  VIEW_MAIN_ROUTE: 'VIEW_MAIN_ROUTE',
  AMEND_ROUTE: 'AMEND_ROUTE',
  VIEW_INTERNAL_CYCLE: 'VIEW_INTERNAL_CYCLE',
  DEFINE_TEAM_SEQUENCE: 'DEFINE_TEAM_SEQUENCE',
  DEFINE_MEMBER_SEQUENCE: 'DEFINE_MEMBER_SEQUENCE',
  APPEND_MEMBER_STEP: 'APPEND_MEMBER_STEP',
  SUBMIT_MEMBER_STEP: 'SUBMIT_MEMBER_STEP',
  COMPLETE_TEAM_STEP: 'COMPLETE_TEAM_STEP',
  FORWARD_ROUTE: 'FORWARD_ROUTE',
  REQUEST_INTERNAL_MEMBER_REVISION: 'REQUEST_INTERNAL_MEMBER_REVISION',
  REQUEST_INTERNAL_TEAM_REVISION: 'REQUEST_INTERNAL_TEAM_REVISION',
  REQUEST_CROSS_DIVISION_FORMAL_REVISION:
    'REQUEST_CROSS_DIVISION_FORMAL_REVISION',
  RESUBMIT_REVISION: 'RESUBMIT_REVISION',
  LIST_COMMUNICATION_RECIPIENTS: 'LIST_COMMUNICATION_RECIPIENTS',
  SEND_COMMUNICATION: 'SEND_COMMUNICATION',
  READ_CONVERSATION: 'READ_CONVERSATION',
  REPLY_CONVERSATION: 'REPLY_CONVERSATION',
  READ_MAIN_HISTORY: 'READ_MAIN_HISTORY',
  READ_INTERNAL_HISTORY: 'READ_INTERNAL_HISTORY',
  READ_AVAILABLE_ACTIONS: 'READ_AVAILABLE_ACTIONS',
  SUBMIT_CLIENT_PACKAGE: 'SUBMIT_CLIENT_PACKAGE',
  RESUBMIT_CLIENT_PACKAGE: 'RESUBMIT_CLIENT_PACKAGE',
  ACCEPT_CLIENT_PACKAGE: 'ACCEPT_CLIENT_PACKAGE',
  REJECT_CLIENT_PACKAGE: 'REJECT_CLIENT_PACKAGE',
  REQUEST_CLIENT_PACKAGE_REVISION: 'REQUEST_CLIENT_PACKAGE_REVISION',
  COORDINATE_CLIENT_REVISION: 'COORDINATE_CLIENT_REVISION',
  REQUEST_RECONSIDERATION: 'REQUEST_RECONSIDERATION',
  ACCEPT_RECONSIDERATION: 'ACCEPT_RECONSIDERATION',
  DENY_RECONSIDERATION: 'DENY_RECONSIDERATION',
} as const;

export type WorkRequestRouteCommand =
  (typeof WORK_REQUEST_ROUTE_COMMAND)[keyof typeof WORK_REQUEST_ROUTE_COMMAND];

type RouteCommandPolicy = {
  permission: PermissionCode;
  compatibleScopes: readonly CustomRoleScope[];
  responsibility: RouteCommandResponsibility;
};

type RouteCommandResponsibility =
  | 'ROUTE_ORIGINATING_LEAD'
  | 'ACTIVE_DIVISION_LEAD'
  | 'ACTIVE_TEAM_LEAD'
  | 'ACTIVE_MEMBER_STEP'
  | 'RELATED_ROUTE_ACTOR'
  | 'REVISION_MEMBER_REQUESTER'
  | 'REVISION_TEAM_REQUESTER'
  | 'REVISION_DIVISION_REQUESTER'
  | 'REVISION_PROBLEM_SOURCE'
  | 'COMMUNICATION_PARTICIPANT'
  | 'LINKED_ACTIVE_CLIENT_CONTACT';

const INTERNAL_READ_SCOPES = [
  CustomRoleScope.company,
  CustomRoleScope.division,
  CustomRoleScope.team,
  CustomRoleScope.member,
] as const;
const ORIGINATING_LEAD_SCOPES = [
  CustomRoleScope.company,
  CustomRoleScope.division,
] as const;
const DIVISION_EXECUTION_SCOPES = [CustomRoleScope.division] as const;
const TEAM_EXECUTION_SCOPES = [CustomRoleScope.team] as const;
const MEMBER_EXECUTION_SCOPES = [CustomRoleScope.member] as const;
const INTERNAL_REVISION_SCOPES = [
  CustomRoleScope.division,
  CustomRoleScope.team,
  CustomRoleScope.member,
] as const;
const EXTERNAL_CLIENT_SCOPES = [
  CustomRoleScope.client,
  CustomRoleScope.client_contact,
] as const;

export const WORK_REQUEST_ROUTE_COMMAND_POLICY = {
  [WORK_REQUEST_ROUTE_COMMAND.CREATE]: {
    permission: PermissionCode.CREATE_WORK_REQUEST,
    compatibleScopes: ORIGINATING_LEAD_SCOPES,
    responsibility: 'ROUTE_ORIGINATING_LEAD',
  },
  [WORK_REQUEST_ROUTE_COMMAND.VIEW_MAIN_ROUTE]: {
    permission: PermissionCode.VIEW_WORK_REQUEST,
    compatibleScopes: INTERNAL_READ_SCOPES,
    responsibility: 'RELATED_ROUTE_ACTOR',
  },
  [WORK_REQUEST_ROUTE_COMMAND.AMEND_ROUTE]: {
    permission: PermissionCode.UPDATE_WORK_REQUEST,
    compatibleScopes: ORIGINATING_LEAD_SCOPES,
    responsibility: 'ROUTE_ORIGINATING_LEAD',
  },
  [WORK_REQUEST_ROUTE_COMMAND.VIEW_INTERNAL_CYCLE]: {
    permission: PermissionCode.VIEW_WORK_REQUEST,
    compatibleScopes: INTERNAL_READ_SCOPES,
    responsibility: 'RELATED_ROUTE_ACTOR',
  },
  [WORK_REQUEST_ROUTE_COMMAND.DEFINE_TEAM_SEQUENCE]: {
    permission: PermissionCode.ASSIGN_WORK_REQUEST_TEAM,
    compatibleScopes: DIVISION_EXECUTION_SCOPES,
    responsibility: 'ACTIVE_DIVISION_LEAD',
  },
  [WORK_REQUEST_ROUTE_COMMAND.DEFINE_MEMBER_SEQUENCE]: {
    permission: PermissionCode.ASSIGN_WORK_REQUEST_MEMBER,
    compatibleScopes: TEAM_EXECUTION_SCOPES,
    responsibility: 'ACTIVE_TEAM_LEAD',
  },
  [WORK_REQUEST_ROUTE_COMMAND.APPEND_MEMBER_STEP]: {
    permission: PermissionCode.ASSIGN_WORK_REQUEST_MEMBER,
    compatibleScopes: TEAM_EXECUTION_SCOPES,
    responsibility: 'ACTIVE_TEAM_LEAD',
  },
  [WORK_REQUEST_ROUTE_COMMAND.SUBMIT_MEMBER_STEP]: {
    permission: PermissionCode.SUBMIT_WORK_REQUEST,
    compatibleScopes: MEMBER_EXECUTION_SCOPES,
    responsibility: 'ACTIVE_MEMBER_STEP',
  },
  [WORK_REQUEST_ROUTE_COMMAND.COMPLETE_TEAM_STEP]: {
    permission: PermissionCode.APPROVE_WORK_REQUEST_REVIEW,
    compatibleScopes: TEAM_EXECUTION_SCOPES,
    responsibility: 'ACTIVE_TEAM_LEAD',
  },
  [WORK_REQUEST_ROUTE_COMMAND.FORWARD_ROUTE]: {
    permission: PermissionCode.ROUTE_FOR_REVIEW,
    compatibleScopes: DIVISION_EXECUTION_SCOPES,
    responsibility: 'ACTIVE_DIVISION_LEAD',
  },
  [WORK_REQUEST_ROUTE_COMMAND.REQUEST_INTERNAL_MEMBER_REVISION]: {
    permission: PermissionCode.REQUEST_WORK_REQUEST_REVISION,
    compatibleScopes: INTERNAL_REVISION_SCOPES,
    responsibility: 'REVISION_MEMBER_REQUESTER',
  },
  [WORK_REQUEST_ROUTE_COMMAND.REQUEST_INTERNAL_TEAM_REVISION]: {
    permission: PermissionCode.REQUEST_WORK_REQUEST_REVISION,
    compatibleScopes: INTERNAL_REVISION_SCOPES,
    responsibility: 'REVISION_TEAM_REQUESTER',
  },
  [WORK_REQUEST_ROUTE_COMMAND.REQUEST_CROSS_DIVISION_FORMAL_REVISION]: {
    permission: PermissionCode.REQUEST_WORK_REQUEST_REVISION,
    compatibleScopes: DIVISION_EXECUTION_SCOPES,
    responsibility: 'REVISION_DIVISION_REQUESTER',
  },
  [WORK_REQUEST_ROUTE_COMMAND.RESUBMIT_REVISION]: {
    permission: PermissionCode.SUBMIT_WORK_REQUEST,
    compatibleScopes: INTERNAL_REVISION_SCOPES,
    responsibility: 'REVISION_PROBLEM_SOURCE',
  },
  [WORK_REQUEST_ROUTE_COMMAND.LIST_COMMUNICATION_RECIPIENTS]: {
    permission: PermissionCode.VIEW_WORK_REQUEST,
    compatibleScopes: INTERNAL_READ_SCOPES,
    responsibility: 'COMMUNICATION_PARTICIPANT',
  },
  [WORK_REQUEST_ROUTE_COMMAND.SEND_COMMUNICATION]: {
    permission: PermissionCode.REQUEST_INFO,
    compatibleScopes: INTERNAL_READ_SCOPES,
    responsibility: 'COMMUNICATION_PARTICIPANT',
  },
  [WORK_REQUEST_ROUTE_COMMAND.READ_CONVERSATION]: {
    permission: PermissionCode.VIEW_WORK_REQUEST,
    compatibleScopes: INTERNAL_READ_SCOPES,
    responsibility: 'COMMUNICATION_PARTICIPANT',
  },
  [WORK_REQUEST_ROUTE_COMMAND.REPLY_CONVERSATION]: {
    permission: PermissionCode.REQUEST_INFO,
    compatibleScopes: INTERNAL_READ_SCOPES,
    responsibility: 'COMMUNICATION_PARTICIPANT',
  },
  [WORK_REQUEST_ROUTE_COMMAND.READ_MAIN_HISTORY]: {
    permission: PermissionCode.VIEW_WORK_REQUEST,
    compatibleScopes: INTERNAL_READ_SCOPES,
    responsibility: 'RELATED_ROUTE_ACTOR',
  },
  [WORK_REQUEST_ROUTE_COMMAND.READ_INTERNAL_HISTORY]: {
    permission: PermissionCode.VIEW_WORK_REQUEST,
    compatibleScopes: INTERNAL_READ_SCOPES,
    responsibility: 'RELATED_ROUTE_ACTOR',
  },
  [WORK_REQUEST_ROUTE_COMMAND.READ_AVAILABLE_ACTIONS]: {
    permission: PermissionCode.VIEW_WORK_REQUEST,
    compatibleScopes: INTERNAL_READ_SCOPES,
    responsibility: 'RELATED_ROUTE_ACTOR',
  },
  [WORK_REQUEST_ROUTE_COMMAND.SUBMIT_CLIENT_PACKAGE]: {
    permission: PermissionCode.SUBMIT_FOR_EXTERNAL_REVIEW,
    compatibleScopes: ORIGINATING_LEAD_SCOPES,
    responsibility: 'ROUTE_ORIGINATING_LEAD',
  },
  [WORK_REQUEST_ROUTE_COMMAND.RESUBMIT_CLIENT_PACKAGE]: {
    permission: PermissionCode.SUBMIT_CLIENT_REVISION,
    compatibleScopes: ORIGINATING_LEAD_SCOPES,
    responsibility: 'ROUTE_ORIGINATING_LEAD',
  },
  [WORK_REQUEST_ROUTE_COMMAND.ACCEPT_CLIENT_PACKAGE]: {
    permission: PermissionCode.ACCEPT_FINAL_DELIVERY,
    compatibleScopes: EXTERNAL_CLIENT_SCOPES,
    responsibility: 'LINKED_ACTIVE_CLIENT_CONTACT',
  },
  [WORK_REQUEST_ROUTE_COMMAND.REJECT_CLIENT_PACKAGE]: {
    permission: PermissionCode.REJECT_FINAL_DELIVERY,
    compatibleScopes: EXTERNAL_CLIENT_SCOPES,
    responsibility: 'LINKED_ACTIVE_CLIENT_CONTACT',
  },
  [WORK_REQUEST_ROUTE_COMMAND.REQUEST_CLIENT_PACKAGE_REVISION]: {
    permission: PermissionCode.REQUEST_REVISION,
    compatibleScopes: EXTERNAL_CLIENT_SCOPES,
    responsibility: 'LINKED_ACTIVE_CLIENT_CONTACT',
  },
  [WORK_REQUEST_ROUTE_COMMAND.COORDINATE_CLIENT_REVISION]: {
    permission: PermissionCode.ROUTE_FOR_REVIEW,
    compatibleScopes: ORIGINATING_LEAD_SCOPES,
    responsibility: 'ROUTE_ORIGINATING_LEAD',
  },
  [WORK_REQUEST_ROUTE_COMMAND.REQUEST_RECONSIDERATION]: {
    permission: PermissionCode.REQUEST_WORK_REQUEST_REVISION,
    compatibleScopes: ORIGINATING_LEAD_SCOPES,
    responsibility: 'ROUTE_ORIGINATING_LEAD',
  },
  [WORK_REQUEST_ROUTE_COMMAND.ACCEPT_RECONSIDERATION]: {
    permission: PermissionCode.ACCEPT_FINAL_DELIVERY,
    compatibleScopes: EXTERNAL_CLIENT_SCOPES,
    responsibility: 'LINKED_ACTIVE_CLIENT_CONTACT',
  },
  [WORK_REQUEST_ROUTE_COMMAND.DENY_RECONSIDERATION]: {
    permission: PermissionCode.REJECT_FINAL_DELIVERY,
    compatibleScopes: EXTERNAL_CLIENT_SCOPES,
    responsibility: 'LINKED_ACTIVE_CLIENT_CONTACT',
  },
} as const satisfies Record<WorkRequestRouteCommand, RouteCommandPolicy>;

export type RouteCommandAuthorization = {
  command: WorkRequestRouteCommand;
  scope: CustomRoleScope | null;
  hasPermission: boolean;
  isActiveSameTenantActor: boolean;
  hasResourceRelationship: boolean;
  hasExactResponsibility: boolean;
  hasValidWorkflowContext: boolean;
};

/**
 * Phase 1's authorization equation. Future route providers must pass the
 * resource-specific facts; no role identity or name is an input to this rule.
 */
export function isRouteCommandAuthorized(
  authorization: RouteCommandAuthorization,
): boolean {
  const policy = WORK_REQUEST_ROUTE_COMMAND_POLICY[authorization.command];
  return (
    authorization.hasPermission &&
    authorization.scope !== null &&
    (policy.compatibleScopes as readonly CustomRoleScope[]).includes(
      authorization.scope,
    ) &&
    authorization.isActiveSameTenantActor &&
    authorization.hasResourceRelationship &&
    authorization.hasExactResponsibility &&
    authorization.hasValidWorkflowContext
  );
}

export function getRouteCommandPermission(
  command: WorkRequestRouteCommand,
): PermissionCode {
  return WORK_REQUEST_ROUTE_COMMAND_POLICY[command].permission;
}

export function getFinalPermissionForWorkRequestAction(
  action: WorkflowActionCode,
): PermissionCode {
  const permission = (
    WORK_REQUEST_FINAL_PERMISSION_BY_ACTION as Partial<
      Record<WorkflowActionCode, PermissionCode>
    >
  )[action];
  if (!permission) {
    throw new Error(
      `No final permission is mapped for workflow action ${action}.`,
    );
  }
  return permission;
}

import {
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

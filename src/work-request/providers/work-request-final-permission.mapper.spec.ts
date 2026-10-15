import {
  PermissionCode,
  WorkflowActionCode,
} from '../../generated/prisma/client';
import {
  DEFERRED_EXTERNAL_WORK_REQUEST_ACTIONS,
  getFinalPermissionForWorkRequestAction,
  WORK_REQUEST_FINAL_PERMISSION_BY_ACTION,
} from './work-request-final-permission.mapper';

describe('Work Request final permission mapping', () => {
  it('maps every Work Request runtime action to its frozen final capability', () => {
    expect(WORK_REQUEST_FINAL_PERMISSION_BY_ACTION).toMatchObject({
      [WorkflowActionCode.ADD_WORK_REQUEST]: PermissionCode.CREATE_WORK_REQUEST,
      [WorkflowActionCode.WR_ASSIGN_DIVISION]:
        PermissionCode.ASSIGN_WORK_REQUEST_DIVISION,
      [WorkflowActionCode.WR_SUBMIT]: PermissionCode.SUBMIT_WORK_REQUEST,
      [WorkflowActionCode.WR_CHECKING_APPROVE]:
        PermissionCode.APPROVE_WORK_REQUEST_REVIEW,
      [WorkflowActionCode.WR_REQUEST_REVISION]:
        PermissionCode.REQUEST_WORK_REQUEST_REVISION,
      [WorkflowActionCode.REQUEST_WORKFLOW_INFO]: PermissionCode.REQUEST_INFO,
      [WorkflowActionCode.RESPOND_WORKFLOW_INFO]:
        PermissionCode.RESPOND_TO_INFO_REQUEST,
    });
  });

  it('has no role-labelled final permission and fails closed for unmapped actions', () => {
    for (const permission of Object.values(
      WORK_REQUEST_FINAL_PERMISSION_BY_ACTION,
    )) {
      expect(permission).not.toMatch(/TMS|CCR|MARKETING|M[123]|LEAD/);
    }
    expect(() =>
      getFinalPermissionForWorkRequestAction(WorkflowActionCode.ADD_BID),
    ).toThrow('No final permission is mapped');
  });

  it('identifies external deferred actions explicitly', () => {
    expect(DEFERRED_EXTERNAL_WORK_REQUEST_ACTIONS).toEqual([]);
  });
});

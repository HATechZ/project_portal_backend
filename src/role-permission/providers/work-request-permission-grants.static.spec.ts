import {
  ActorRoleCode,
  WorkflowActionCode,
} from '../../generated/prisma/client';
import {
  rolePermissionCodes,
  workRequestPermissionCodes,
} from '../../../prisma/seed/data/permissions.data';

describe('Work Request fixed-role permission grants', () => {
  const assigned = (role: ActorRoleCode) =>
    rolePermissionCodes[role].filter((code) =>
      workRequestPermissionCodes.has(code),
    );
  const expectAssigned = (
    role: ActorRoleCode,
    expected: readonly WorkflowActionCode[],
  ) => {
    expect(assigned(role)).toHaveLength(expected.length);
    expect(assigned(role)).toEqual(expect.arrayContaining(expected));
  };

  it('assigns the approved baseline without workflow bypasses', () => {
    expectAssigned(ActorRoleCode.system_admin, [
      WorkflowActionCode.ADD_WORK_REQUEST_DOCUMENT,
      WorkflowActionCode.ADD_WORK_REQUEST,
      WorkflowActionCode.ADD_WORK_REQUEST_NOTE,
      WorkflowActionCode.REQUEST_WORKFLOW_INFO,
      WorkflowActionCode.RESPOND_WORKFLOW_INFO,
      WorkflowActionCode.VIEW_WORK_REQUEST,
      WorkflowActionCode.UPDATE_WORK_REQUEST,
    ]);
    expectAssigned(ActorRoleCode.ccr_coordinator, [
      WorkflowActionCode.ADD_WORK_REQUEST,
      WorkflowActionCode.ADD_WORK_REQUEST_DOCUMENT,
      WorkflowActionCode.ADD_WORK_REQUEST_NOTE,
      WorkflowActionCode.REQUEST_WORKFLOW_INFO,
      WorkflowActionCode.RESPOND_WORKFLOW_INFO,
      WorkflowActionCode.VIEW_WORK_REQUEST,
    ]);
  });

  it.each([
    [
      ActorRoleCode.division_head,
      [
        WorkflowActionCode.VIEW_WORK_REQUEST,
        WorkflowActionCode.REQUEST_WORKFLOW_INFO,
        WorkflowActionCode.RESPOND_WORKFLOW_INFO,
        WorkflowActionCode.WR_ASSIGN_DIVISION,
        WorkflowActionCode.WR_DIVISION_HEAD_APPROVE,
        WorkflowActionCode.WR_DIVISION_HEAD_REQUEST_REVISION,
      ],
    ],
    [
      ActorRoleCode.division_lead,
      [
        WorkflowActionCode.ADD_WORK_REQUEST_DOCUMENT,
        WorkflowActionCode.ADD_WORK_REQUEST_NOTE,
        WorkflowActionCode.REQUEST_WORKFLOW_INFO,
        WorkflowActionCode.RESPOND_WORKFLOW_INFO,
        WorkflowActionCode.VIEW_WORK_REQUEST,
        WorkflowActionCode.WR_ASSIGN_TEAM,
        WorkflowActionCode.WR_DIVISION_LEAD_APPROVE,
        WorkflowActionCode.WR_DIVISION_LEAD_REQUEST_REVISION,
      ],
    ],
    [
      ActorRoleCode.team_lead,
      [
        WorkflowActionCode.VIEW_WORK_REQUEST,
        WorkflowActionCode.REQUEST_WORKFLOW_INFO,
        WorkflowActionCode.RESPOND_WORKFLOW_INFO,
        WorkflowActionCode.WR_ASSIGN_MEMBER,
        WorkflowActionCode.WR_TEAM_LEAD_APPROVE,
        WorkflowActionCode.WR_TEAM_LEAD_REQUEST_REVISION,
      ],
    ],
    [
      ActorRoleCode.division_member,
      [
        WorkflowActionCode.ADD_WORK_REQUEST_DOCUMENT,
        WorkflowActionCode.ADD_WORK_REQUEST_NOTE,
        WorkflowActionCode.REQUEST_WORKFLOW_INFO,
        WorkflowActionCode.RESPOND_WORKFLOW_INFO,
        WorkflowActionCode.VIEW_WORK_REQUEST,
        WorkflowActionCode.WR_SUBMIT,
      ],
    ],
  ] as const)(
    '%s receives only its approved Work Request actions',
    (role, expected) => {
      expectAssigned(role, expected);
    },
  );

  it.each([
    ActorRoleCode.tms_manager,
    ActorRoleCode.tms_drawing,
    ActorRoleCode.tms_checking,
    ActorRoleCode.tms_approval,
    ActorRoleCode.client_owner,
  ])(
    '%s receives no new Work Request workflow or read/update action',
    (role) => {
      expect(
        assigned(role).filter(
          (code) =>
            code.startsWith('WR_') ||
            code === WorkflowActionCode.VIEW_WORK_REQUEST ||
            code === WorkflowActionCode.UPDATE_WORK_REQUEST,
        ),
      ).toEqual([]);
    },
  );
});

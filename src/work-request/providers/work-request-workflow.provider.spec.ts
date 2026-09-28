import {
  WorkflowActionCode,
  WorkRequestV1StateCode as State,
} from '../../generated/prisma/client';
import { WorkRequestWorkflowProvider } from './work-request-workflow.provider';

describe('WorkRequestWorkflowProvider', () => {
  const snapshot = (state: State) => ({
    state,
    parent: { clientId: 'client-a', companyId: 'company-a' },
    active: { DIVISION: 'division-a', TEAM: 'team-a', MEMBER: 'member-a' },
    teamLeadMemberId: 'team-lead-a',
  });
  const actor = (permission: WorkflowActionCode, memberId = 'member-a') =>
    ({
      id: 'actor-a',
      boundTeamId: null,
      role: {
        isSystemRole: true,
        customScope: null,
        userRolesByRoleId: [{ teamId: null }],
        workflowActionRolePermissionsByRoleId: [
          { action: { code: permission } },
        ],
      },
      member: {
        id: memberId,
        companyId: 'company-a',
        isActive: true,
        company: { isActive: true },
      },
    }) as never;
  const subject = (state: State, action: WorkflowActionCode) => {
    const repository = {
      prepare: jest.fn().mockResolvedValue(snapshot(state)),
      actionCode: jest.fn().mockResolvedValue({ code: action }),
      append: jest.fn().mockResolvedValue({ currentState: state }),
    };
    const provider = new WorkRequestWorkflowProvider(
      repository as never,
      { execute: (work: () => Promise<unknown>) => work() } as never,
      {
        resolve: jest
          .fn()
          .mockReturnValue({ isSystemRole: true, customScope: null }),
        assertCanAccess: jest.fn(),
      } as never,
    );
    return { provider, repository };
  };

  it.each([
    [
      State.MEMBER_ASSIGNED,
      WorkflowActionCode.WR_SUBMIT,
      State.MEMBER_SUBMITTED,
    ],
    [
      State.MEMBER_SUBMITTED,
      WorkflowActionCode.WR_TEAM_LEAD_APPROVE,
      State.TEAM_LEAD_APPROVED,
    ],
    [
      State.MEMBER_SUBMITTED,
      WorkflowActionCode.WR_TEAM_LEAD_REQUEST_REVISION,
      State.MEMBER_ASSIGNED,
    ],
    [
      State.TEAM_LEAD_APPROVED,
      WorkflowActionCode.WR_DIVISION_LEAD_APPROVE,
      State.DIVISION_LEAD_APPROVED,
    ],
    [
      State.TEAM_LEAD_APPROVED,
      WorkflowActionCode.WR_DIVISION_LEAD_REQUEST_REVISION,
      State.TEAM_ASSIGNED,
    ],
    [
      State.DIVISION_LEAD_APPROVED,
      WorkflowActionCode.WR_DIVISION_HEAD_APPROVE,
      State.DIVISION_HEAD_APPROVED,
    ],
    [
      State.DIVISION_LEAD_APPROVED,
      WorkflowActionCode.WR_DIVISION_HEAD_REQUEST_REVISION,
      State.DIVISION_ASSIGNED,
    ],
  ])(
    'appends the expected event-derived state for %s',
    async (state, action, expected) => {
      const { provider, repository } = subject(state, action);
      const reviewer =
        action === WorkflowActionCode.WR_TEAM_LEAD_APPROVE ||
        action === WorkflowActionCode.WR_TEAM_LEAD_REQUEST_REVISION
          ? 'team-lead-a'
          : 'member-a';
      if (action === WorkflowActionCode.WR_SUBMIT) {
        await provider.submit('request-a', {}, actor(action));
      } else {
        await provider.action(
          'request-a',
          'action-a',
          undefined,
          'note',
          actor(action, reviewer),
        );
      }
      expect(repository.append).toHaveBeenCalledTimes(1);
      expect(repository.append).toHaveBeenCalledWith(
        expect.objectContaining({ resultingState: expected }),
      );
    },
  );

  it('rejects stale transitions without appending another event', async () => {
    const { provider, repository } = subject(
      State.MEMBER_SUBMITTED,
      WorkflowActionCode.WR_SUBMIT,
    );
    await expect(
      provider.submit('request-a', {}, actor(WorkflowActionCode.WR_SUBMIT)),
    ).rejects.toThrow();
    expect(repository.append).not.toHaveBeenCalled();
  });

  it('rejects a Member who is not the active Member assignment', async () => {
    const { provider, repository } = subject(
      State.MEMBER_ASSIGNED,
      WorkflowActionCode.WR_SUBMIT,
    );
    await expect(
      provider.submit(
        'request-a',
        {},
        actor(WorkflowActionCode.WR_SUBMIT, 'member-b'),
      ),
    ).rejects.toThrow();
    expect(repository.append).not.toHaveBeenCalled();
  });
});

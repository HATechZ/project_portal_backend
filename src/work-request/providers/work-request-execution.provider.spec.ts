import { PermissionCode } from '../../generated/prisma/client';
import { WorkRequestExecutionProvider } from './work-request-execution.provider';
import { WorkRequestExecutionController } from '../work-request-execution.controller';
import { WorkRequestInternalWorkflowProvider } from './work-request-internal-workflow.provider';

describe('WorkRequestExecutionProvider scope boundary', () => {
  const execution = {
    internalCycle: jest.fn(),
    defineTeamSequence: jest.fn(),
    defineMemberSequence: jest.fn(),
    appendMemberStep: jest.fn(),
    submitMemberStep: jest.fn(),
    completeTeamStep: jest.fn(),
  };
  const provider = new WorkRequestExecutionProvider(
    execution as never,
    new WorkRequestInternalWorkflowProvider(),
  );

  const actor = (scope: 'division' | 'team' | 'member') =>
    ({
      id: 'actor-a',
      member: { id: 'member-a', isActive: true },
      role: {
        customScope: scope,
        rolePermissions: [
          {
            revokedAt: null,
            permission: {
              code: PermissionCode.ASSIGN_WORK_REQUEST_TEAM,
              scopeCompatibilities: [{ scope }],
            },
          },
        ],
      },
    }) as never;

  beforeEach(() => jest.clearAllMocks());

  it.each([
    undefined,
    { message: 'Completed' },
    { documentVersionIds: ['version-a'] },
    { message: 'Completed', documentVersionIds: ['version-a'] },
  ])(
    'passes the production controller payload and actor in repository order: %j',
    (input) => {
      const member = actor('member');
      new WorkRequestExecutionController(provider).submitMemberStep(
        'request-a',
        'step-a',
        input!,
        member,
      );
      expect(execution.submitMemberStep).toHaveBeenCalledWith(
        'request-a',
        'step-a',
        'actor-a',
        'member-a',
        input,
        false,
      );
    },
  );

  it('does not let a compatible permission bypass the Division execution scope', () => {
    expect(() =>
      provider.defineTeamSequence(
        'request-a',
        'cycle-a',
        { teamIds: ['team-a'] },
        actor('team'),
      ),
    ).toThrow("don't have permission");
    expect(execution.defineTeamSequence).not.toHaveBeenCalled();
  });

  it('does not let a Division-scoped profile define a Team member sequence', () => {
    expect(() =>
      provider.defineMemberSequence(
        'request-a',
        'team-step-a',
        { memberIds: ['member-a'] },
        actor('division'),
      ),
    ).toThrow("don't have permission");
    expect(execution.defineMemberSequence).not.toHaveBeenCalled();
  });

  it('does not let a Team-scoped profile submit a Member step', () => {
    expect(() =>
      provider.submitMemberStep(
        'request-a',
        'member-step-a',
        {},
        actor('team'),
      ),
    ).toThrow("don't have permission");
    expect(execution.submitMemberStep).not.toHaveBeenCalled();
  });

  it('adds the Internal Workflow only to the already-authorized internal-cycle read', async () => {
    execution.internalCycle.mockResolvedValue({
      id: 'cycle-a',
      completedAt: null,
      routeStep: {
        divisionId: 'division-a',
        division: { id: 'division-a', name: 'Project Management' },
      },
      teamSteps: [
        {
          id: 'team-step-a',
          ordinal: 1,
          activatedAt: new Date(),
          completedAt: null,
          team: { id: 'team-a', name: 'Team A' },
        },
      ],
      availableActions: [],
      workflowVisibility: {
        canViewMainWorkflow: false,
        canViewInternalWorkflow: true,
      },
    });

    const result = await provider.internalCycle(
      'request-a',
      'cycle-a',
      actor('team'),
    );

    expect(result.internalWorkflow).toEqual(
      expect.objectContaining({
        divisionId: 'division-a',
        currentTeamStepId: 'team-step-a',
        steps: expect.arrayContaining([
          expect.objectContaining({ kind: 'division-start' }),
        ]),
      }),
    );
    expect(execution.internalCycle).toHaveBeenCalledWith(
      'request-a',
      'cycle-a',
      'member-a',
      false,
    );
    expect(result.workflowVisibility).toEqual({
      canViewMainWorkflow: false,
      canViewInternalWorkflow: true,
    });
  });
});

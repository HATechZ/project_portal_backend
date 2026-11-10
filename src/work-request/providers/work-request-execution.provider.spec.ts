import { PermissionCode } from '../../generated/prisma/client';
import { WorkRequestExecutionProvider } from './work-request-execution.provider';
import { WorkRequestExecutionController } from '../work-request-execution.controller';

describe('WorkRequestExecutionProvider scope boundary', () => {
  const execution = {
    defineTeamSequence: jest.fn(),
    defineMemberSequence: jest.fn(),
    appendMemberStep: jest.fn(),
    submitMemberStep: jest.fn(),
    completeTeamStep: jest.fn(),
  };
  const provider = new WorkRequestExecutionProvider(execution as never);

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
  ])('passes the production controller payload and actor in repository order: %j', (input) => {
    const member = actor('member');
    new WorkRequestExecutionController(provider).submitMemberStep('request-a', 'step-a', input!, member);
    expect(execution.submitMemberStep).toHaveBeenCalledWith('request-a', 'step-a', 'actor-a', 'member-a', input, false);
  });

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
      provider.submitMemberStep('request-a', 'member-step-a', {}, actor('team')),
    ).toThrow("don't have permission");
    expect(execution.submitMemberStep).not.toHaveBeenCalled();
  });
});

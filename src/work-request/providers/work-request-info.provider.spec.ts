import {
  WorkflowActionCode,
  WorkRequestV1StateCode as State,
} from '../../generated/prisma/client';
import { WorkRequestInfoProvider } from './work-request-info.provider';

describe('WorkRequestInfoProvider', () => {
  const actor = (
    permission: WorkflowActionCode,
    customScope: string | null = null,
    boundTeamId = customScope === 'team' ? 'team-a' : null,
  ) =>
    ({
      id: 'actor-a',
      boundTeamId,
      role: {
        isSystemRole: customScope === null,
        customScope,
        userRolesByRoleId: [{ teamId: boundTeamId }],
        workflowActionRolePermissionsByRoleId: [
          { action: { code: permission } },
        ],
      },
    }) as never;

  const prepared = (targetTeamId = 'team-a', targetDivisionId = 'division-a') =>
    ({
      request: {
        events: [{ resultingState: State.MEMBER_ASSIGNED }],
        assignments: [
          { level: 'DIVISION', divisionId: 'division-a' },
          { level: 'TEAM', teamId: 'team-a' },
        ],
      },
      parent: {
        clientId: 'client-a',
        client: { companyId: 'company-a' },
      },
      target: {
        roleId: 'role-a',
        user: {
          isActive: true,
          userRolesByUserId: [{ roleId: 'role-a' }],
        },
        member: {
          isActive: true,
          companyId: 'company-a',
          divisionId: targetDivisionId,
          teamMembersByMemberId: [
            { teamId: targetTeamId, team: { isActive: true } },
          ],
        },
        clientContact: null,
      },
    }) as never;

  const subject = (snapshot = prepared()) => {
    const repository = {
      prepare: jest.fn().mockResolvedValue(snapshot),
      create: jest.fn().mockResolvedValue({ id: 'info-a' }),
      respond: jest.fn().mockResolvedValue({
        kind: 'ok',
        response: { id: 'response-a' },
      }),
      history: jest.fn().mockResolvedValue([{ id: 'info-a' }]),
    };
    const scope = { assert: jest.fn() };
    const scopes = {
      resolve: jest
        .fn()
        .mockReturnValue({ isSystemRole: true, customScope: null }),
      assertCanAccess: jest.fn(),
    };
    const provider = new WorkRequestInfoProvider(
      repository as never,
      { execute: (work: () => Promise<unknown>) => work() } as never,
      scope as never,
      scopes as never,
    );
    return { provider, repository, scope, scopes };
  };

  it('persists a scoped information request without appending a workflow transition', async () => {
    const { provider, repository, scope } = subject();

    await expect(
      provider.request(
        'request-a',
        { targetActorId: 'target-a', message: 'Please clarify the load plan.' },
        actor(WorkflowActionCode.REQUEST_WORKFLOW_INFO),
      ),
    ).resolves.toEqual({ id: 'info-a' });

    expect(scope.assert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ teamId: 'team-a' }),
    );
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        stateAtRequest: State.MEMBER_ASSIGNED,
        requestedByActorId: 'actor-a',
        targetActorId: 'target-a',
      }),
    );
    expect(repository.respond).not.toHaveBeenCalled();
  });

  it('requires the request-information grant before persistence', async () => {
    const { provider, repository } = subject();

    await expect(
      provider.request(
        'request-a',
        { targetActorId: 'target-a', message: 'Clarify.' },
        actor(WorkflowActionCode.VIEW_WORK_REQUEST),
      ),
    ).rejects.toThrow();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects a TEAM-scoped requester when the target lacks membership in the bound Team', async () => {
    const { provider, repository } = subject(prepared('team-b'));

    await expect(
      provider.request(
        'request-a',
        { targetActorId: 'target-a', message: 'Clarify.' },
        actor(WorkflowActionCode.REQUEST_WORKFLOW_INFO, 'team'),
      ),
    ).rejects.toThrow();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('requires a DIVISION-scoped requester and target to match the active Division', async () => {
    const { provider, repository, scopes } = subject();
    scopes.resolve.mockReturnValue({
      isSystemRole: false,
      customScope: 'division',
    });

    await expect(
      provider.request(
        'request-a',
        { targetActorId: 'target-a', message: 'Clarify.' },
        actor(WorkflowActionCode.REQUEST_WORKFLOW_INFO, 'division'),
      ),
    ).resolves.toEqual({ id: 'info-a' });
    expect(scopes.assertCanAccess).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ allowTenantAdmin: false }),
    );
    expect(repository.create).toHaveBeenCalledTimes(1);
  });

  it('rejects a DIVISION-scoped request for a target outside the active Division', async () => {
    const { provider, repository, scopes } = subject(
      prepared('team-a', 'division-b'),
    );
    scopes.resolve.mockReturnValue({
      isSystemRole: false,
      customScope: 'division',
    });

    await expect(
      provider.request(
        'request-a',
        { targetActorId: 'target-a', message: 'Clarify.' },
        actor(WorkflowActionCode.REQUEST_WORKFLOW_INFO, 'division'),
      ),
    ).rejects.toThrow();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('appends a response only for the exact targeted actor and preserves the request', async () => {
    const { provider, repository } = subject();

    await expect(
      provider.respond(
        'request-a',
        'info-a',
        { message: 'The plan is attached to the bid.' },
        actor(WorkflowActionCode.RESPOND_WORKFLOW_INFO),
      ),
    ).resolves.toEqual({ id: 'response-a' });

    expect(repository.respond).toHaveBeenCalledWith(
      'request-a',
      'info-a',
      'actor-a',
      'The plan is attached to the bid.',
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', 'cross-tenant or missing information request'],
    ['forbidden', 'a response actor who is not the request target'],
    ['closed', 'a duplicate response after closure'],
  ] as const)('rejects %s response result for %s', async (kind) => {
    const { provider, repository } = subject();
    repository.respond.mockResolvedValue({ kind });

    await expect(
      provider.respond(
        'request-a',
        'info-a',
        { message: 'Response.' },
        actor(WorkflowActionCode.RESPOND_WORKFLOW_INFO),
      ),
    ).rejects.toThrow();
  });

  it('returns tenant-scoped information history without changing workflow state', async () => {
    const { provider, repository, scope } = subject();

    await expect(
      provider.history(
        'request-a',
        actor(WorkflowActionCode.VIEW_WORK_REQUEST),
      ),
    ).resolves.toEqual([{ id: 'info-a' }]);
    expect(repository.history).toHaveBeenCalledWith('request-a');
    expect(scope.assert).toHaveBeenCalledTimes(1);
  });
});

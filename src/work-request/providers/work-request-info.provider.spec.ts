import {
  WorkflowActionCode,
  WorkRequestV1StateCode as State,
} from '../../generated/prisma/client';
import { WorkRequestInfoProvider } from './work-request-info.provider';
import { getFinalPermissionForWorkRequestAction } from './work-request-final-permission.mapper';

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
        systemRole: { systemCode: 'tenant_super_admin' },
        userRolesByRoleId: [{ teamId: boundTeamId }],
        rolePermissions: [
          {
            revokedAt: null,
            permission: {
              code: getFinalPermissionForWorkRequestAction(permission),
            },
          },
        ],
      },
      member: {
        id: 'member-a',
        isActive: true,
        company: { isActive: true },
        divisionLeadsByMemberId: [{ divisionId: 'division-a' }],
      },
    }) as never;

  const prepared = (targetTeamId = 'team-a', targetDivisionId = 'division-a') =>
    ({
      request: {
        events: [{ resultingState: State.MEMBER_ASSIGNED }],
        assignments: [
          { level: 'MEMBER', memberId: 'member-a' },
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
    const provider = new WorkRequestInfoProvider(
      repository as never,
      { execute: (work: () => Promise<unknown>) => work() } as never,
    );
    return { provider, repository };
  };

  it('persists a scoped information request without appending a workflow transition', async () => {
    const { provider, repository } = subject();

    await expect(
      provider.request(
        'request-a',
        { targetActorId: 'target-a', message: 'Please clarify the load plan.' },
        actor(WorkflowActionCode.REQUEST_WORKFLOW_INFO),
      ),
    ).resolves.toEqual({ id: 'info-a' });

    expect(repository.create).toHaveBeenCalledTimes(1);
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
    ).rejects.toThrow("You don't have permission");
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('does not derive clarification authority from a Team or Division title alone', async () => {
    const hierarchyOnly = prepared();
    hierarchyOnly.request.assignments = [{ level: 'TEAM', teamId: 'team-a', team: { isActive: true, leadMemberId: 'member-a' } }];
    const { provider, repository } = subject(hierarchyOnly);
    await expect(provider.request('request-a', { targetActorId: 'target-a', message: 'Clarify.' }, actor(WorkflowActionCode.REQUEST_WORKFLOW_INFO, 'team'))).rejects.toThrow();
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

  it('keeps the main state unchanged across reassignment during an open clarification', async () => {
    const { provider, repository } = subject();
    await provider.request('request-a', { targetActorId: 'target-a', message: 'Clarify.' }, actor(WorkflowActionCode.REQUEST_WORKFLOW_INFO));
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ stateAtRequest: State.MEMBER_ASSIGNED }));
    await provider.respond('request-a', 'info-a', { message: 'Done.' }, actor(WorkflowActionCode.RESPOND_WORKFLOW_INFO));
    expect(repository.prepare).toHaveBeenCalled();
  });

  it('returns tenant-scoped information history without changing workflow state', async () => {
    const { provider, repository } = subject();

    await expect(
      provider.history(
        'request-a',
        actor(WorkflowActionCode.VIEW_WORK_REQUEST),
      ),
    ).resolves.toEqual([{ id: 'info-a' }]);
    expect(repository.history).toHaveBeenCalledWith('request-a');
  });
});

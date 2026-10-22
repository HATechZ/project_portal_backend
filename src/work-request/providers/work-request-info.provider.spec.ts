import {
  WorkflowActionCode,
  WorkRequestV1StateCode as State,
} from '../../generated/prisma/client';
import { WorkRequestInfoProvider } from './work-request-info.provider';
import { getFinalPermissionForWorkRequestAction } from './work-request-final-permission.mapper';
import { RequestContext } from '../../common/context/request-context';

describe('WorkRequestInfoProvider', () => {
  beforeEach(() => {
    jest.spyOn(RequestContext, 'requireTenantId').mockReturnValue('tenant-a');
  });
  const actor = (
    permission: WorkflowActionCode,
    customScope: string | null = null,
    boundTeamId = customScope === 'team' ? 'team-a' : null,
  ) =>
    ({
      id: 'actor-a',
      isActive: true,
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
        companyId: 'company-a',
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
          { level: 'MEMBER', memberId: 'member-target' },
          { level: 'CHECKING', memberId: 'member-a' },
        ],
      },
      parent: {
        clientId: 'client-a',
        client: { companyId: 'company-a' },
      },
      target: {
        id: 'target-a',
        isActive: true,
        roleId: 'role-a',
        user: {
          isActive: true,
          userRolesByUserId: [{ roleId: 'role-a' }],
        },
        member: {
          id: 'member-target',
          isActive: true,
          company: { isActive: true },
          companyId: 'company-a',
          divisionId: targetDivisionId,
          teamMembersByMemberId: [
            { teamId: targetTeamId, team: { isActive: true } },
          ],
        },
        clientContact: null,
      },
    }) as never;

  const record = (snapshot: ReturnType<typeof prepared>) => ({
    id: 'info-a',
    parentInfoRequestId: null,
    requestedByActor: {
      id: 'actor-a',
      member: { id: 'member-a' },
      clientContact: null,
    },
    targetActor: {
      id: 'target-a',
      member: { id: 'member-target' },
      clientContact: null,
    },
    message: 'Clarify.',
    status: 'OPEN',
    stateAtRequest: State.MEMBER_ASSIGNED,
    requestedAt: new Date('2026-10-15T00:00:00.000Z'),
    closedAt: null,
    attachments: [],
    responses: [],
  });

  const subject = (snapshot = prepared()) => {
    snapshot.info = { requestedByActorId: 'actor-a', targetActorId: 'actor-a' };
    const repository = {
      prepare: jest.fn().mockResolvedValue(snapshot),
      create: jest
        .fn()
        .mockResolvedValue({ request: record(snapshot), duplicate: false }),
      respond: jest.fn().mockResolvedValue({
        kind: 'ok',
        response: {
          id: 'response-a',
          message: 'Response.',
          respondedAt: new Date('2026-10-15T00:00:00.000Z'),
          attachments: [],
        },
      }),
      history: jest.fn().mockResolvedValue([record(snapshot)]),
      isRouteWorkRequest: jest.fn().mockResolvedValue(null),
    };
    const provider = new WorkRequestInfoProvider(
      repository as never,
      { execute: (work: () => Promise<unknown>) => work() } as never,
      { enqueue: jest.fn() } as never,
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
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'info-a',
        parentInfoRequestId: null,
        requester: { actorId: 'actor-a', type: 'INTERNAL_MEMBER' },
        target: { actorId: 'target-a', type: 'INTERNAL_MEMBER' },
        status: 'OPEN',
        stateAtRequest: State.MEMBER_ASSIGNED,
        attachments: [],
        responses: [],
      }),
    );

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

  it('rejects the historical C2 request/respond lifecycle for a route Work Request', async () => {
    const { provider, repository } = subject();
    repository.isRouteWorkRequest.mockResolvedValue({ id: 'route-a' });
    await expect(
      provider.request(
        'request-a',
        { targetActorId: 'target-a', message: 'This must be private pair communication.' },
        actor(WorkflowActionCode.REQUEST_WORKFLOW_INFO),
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(repository.create).not.toHaveBeenCalled();
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
    hierarchyOnly.request.assignments = [
      {
        level: 'TEAM',
        teamId: 'team-a',
        team: { isActive: true, leadMemberId: 'member-a' },
      },
    ];
    const { provider, repository } = subject(hierarchyOnly);
    await expect(
      provider.request(
        'request-a',
        { targetActorId: 'target-a', message: 'Clarify.' },
        actor(WorkflowActionCode.REQUEST_WORKFLOW_INFO, 'team'),
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
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'response-a',
        responder: { actorId: 'actor-a', type: 'INTERNAL_MEMBER' },
        attachments: [],
      }),
    );

    expect(repository.respond).toHaveBeenCalledWith(
      'request-a',
      'info-a',
      'actor-a',
      'The plan is attached to the bid.',
      undefined,
      undefined,
      undefined,
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
    await provider.request(
      'request-a',
      { targetActorId: 'target-a', message: 'Clarify.' },
      actor(WorkflowActionCode.REQUEST_WORKFLOW_INFO),
    );
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ stateAtRequest: State.MEMBER_ASSIGNED }),
    );
    await provider.respond(
      'request-a',
      'info-a',
      { message: 'Done.' },
      actor(WorkflowActionCode.RESPOND_WORKFLOW_INFO),
    );
    expect(repository.prepare).toHaveBeenCalled();
  });

  it('returns tenant-scoped information history without changing workflow state', async () => {
    const { provider, repository } = subject();

    await expect(
      provider.history(
        'request-a',
        actor(WorkflowActionCode.VIEW_WORK_REQUEST),
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'info-a',
        requester: { actorId: 'actor-a', type: 'INTERNAL_MEMBER' },
        target: { actorId: 'target-a', type: 'INTERNAL_MEMBER' },
        attachments: [],
        responses: [],
      }),
    ]);
    expect(repository.history).toHaveBeenCalledWith('request-a', undefined);
  });
});

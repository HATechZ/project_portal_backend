import {
  WorkflowActionCode,
  WorkRequestV1AssignmentLevelCode as Level,
  WorkRequestV1StateCode as State,
} from '../../generated/prisma/client';
import { RequestContext } from '../../common/context/request-context';
import { WorkRequestAssignmentProvider } from './work-request-assignment.provider';

describe('WorkRequestAssignmentProvider', () => {
  const snapshot = (
    state: State,
    active: Partial<Record<Level, string>> = {},
  ) => ({
    parentCompanyId: 'company-a',
    state,
    active,
    target: {
      companyId: 'company-a',
      divisionId: 'division-a',
      teamId: 'team-a',
    },
    boundTeam: {
      id: 'team-a',
      companyId: 'company-a',
      divisionId: 'division-a',
    },
  });
  const actor = (
    permission: WorkflowActionCode,
    customScope: string | null = null,
  ) =>
    ({
      id: 'actor-a',
      boundTeamId: customScope === 'team' ? 'team-a' : null,
      role: {
        isSystemRole: customScope === null,
        customScope,
        userRolesByRoleId: [
          { teamId: customScope === 'team' ? 'team-a' : null },
        ],
        workflowActionRolePermissionsByRoleId: [
          { action: { code: permission } },
        ],
      },
    }) as never;
  const subject = (prepared = snapshot(State.CREATED)) => {
    const repository = {
      prepare: jest.fn().mockResolvedValue(prepared),
      findByIdempotencyKey: jest.fn().mockResolvedValue(null),
      write: jest.fn().mockResolvedValue({
        id: 'history-a',
        event: {
          id: 'event-a',
          action: 'DIVISION_ASSIGNED',
          occurredAt: new Date(),
        },
      }),
    };
    const resourceScope = { assert: jest.fn() };
    const scopes = {
      resolve: jest
        .fn()
        .mockReturnValue({ isSystemRole: true, customScope: null }),
      assertCanAccess: jest.fn(),
    };
    const outbox = { enqueue: jest.fn() };
    const provider = new WorkRequestAssignmentProvider(
      repository as never,
      { execute: (work: () => Promise<unknown>) => work() } as never,
      resourceScope as never,
      scopes as never,
      { find: jest.fn(), parentScope: jest.fn() } as never,
      { history: jest.fn() } as never,
      outbox as never,
    );
    return { provider, repository, resourceScope, scopes, outbox };
  };
  const assign = (
    provider: WorkRequestAssignmentProvider,
    level: Level,
    permission: WorkflowActionCode,
    note?: string,
    customScope?: string | null,
  ) => {
    const activeActor = actor(permission, customScope);
    if (level === Level.DIVISION)
      return RequestContext.run(
        { requestId: 'request-a', tenantId: 'tenant-a' },
        () =>
          provider.division(
            'request-a',
            { divisionId: 'target-a', note },
            activeActor,
          ),
      );
    if (level === Level.TEAM)
      return RequestContext.run(
        { requestId: 'request-a', tenantId: 'tenant-a' },
        () =>
          provider.team('request-a', { teamId: 'target-a', note }, activeActor),
      );
    return RequestContext.run(
      { requestId: 'request-a', tenantId: 'tenant-a' },
      () =>
        provider.member(
          'request-a',
          { memberId: 'target-a', note },
          activeActor,
        ),
    );
  };

  it.each([
    [Level.DIVISION, State.CREATED, {}, WorkflowActionCode.WR_ASSIGN_DIVISION],
    [
      Level.TEAM,
      State.DIVISION_ASSIGNED,
      { DIVISION: 'division-a' },
      WorkflowActionCode.WR_ASSIGN_TEAM,
    ],
    [
      Level.MEMBER,
      State.TEAM_ASSIGNED,
      { DIVISION: 'division-a', TEAM: 'team-a' },
      WorkflowActionCode.WR_ASSIGN_MEMBER,
    ],
  ])(
    'assigns %s only from its first-assignment state',
    async (level, state, active, permission) => {
      const { provider, repository } = subject(snapshot(state, active));
      await assign(provider, level, permission);
      expect(repository.write).toHaveBeenCalledWith(
        expect.objectContaining({
          resultingState:
            state === State.CREATED
              ? State.DIVISION_ASSIGNED
              : state === State.DIVISION_ASSIGNED
                ? State.TEAM_ASSIGNED
                : State.MEMBER_ASSIGNED,
          replacing: false,
        }),
      );
    },
  );

  it.each([
    [
      Level.DIVISION,
      State.DIVISION_ASSIGNED,
      { DIVISION: 'division-a' },
      WorkflowActionCode.WR_ASSIGN_DIVISION,
      'DIVISION_REASSIGNED',
    ],
    [
      Level.TEAM,
      State.TEAM_ASSIGNED,
      { DIVISION: 'division-a', TEAM: 'team-a' },
      WorkflowActionCode.WR_ASSIGN_TEAM,
      'TEAM_REASSIGNED',
    ],
    [
      Level.MEMBER,
      State.MEMBER_ASSIGNED,
      { DIVISION: 'division-a', TEAM: 'team-a', MEMBER: 'member-a' },
      WorkflowActionCode.WR_ASSIGN_MEMBER,
      'MEMBER_REASSIGNED',
    ],
  ])(
    'preserves state when reassigning %s',
    async (level, state, active, permission, action) => {
      const { provider, repository } = subject(snapshot(state, active));
      await assign(provider, level, permission, 'reason');
      expect(repository.write).toHaveBeenCalledWith(
        expect.objectContaining({
          priorState: state,
          resultingState: state,
          action,
          replacing: true,
        }),
      );
    },
  );

  it('rejects a missing, inactive, or cross-tenant target before writing history', async () => {
    const { provider, repository } = subject({
      ...snapshot(State.CREATED),
      target: null,
    });
    await expect(
      assign(provider, Level.DIVISION, WorkflowActionCode.WR_ASSIGN_DIVISION),
    ).rejects.toThrow();
    expect(repository.write).not.toHaveBeenCalled();
  });

  it.each([
    [Level.TEAM, State.DIVISION_ASSIGNED, { DIVISION: 'division-b' }],
    [
      Level.MEMBER,
      State.TEAM_ASSIGNED,
      { DIVISION: 'division-b', TEAM: 'team-a' },
    ],
  ])('rejects %s outside the active Division', async (level, state, active) => {
    const { provider, repository } = subject(snapshot(state, active));
    await expect(
      assign(
        provider,
        level,
        level === Level.TEAM
          ? WorkflowActionCode.WR_ASSIGN_TEAM
          : WorkflowActionCode.WR_ASSIGN_MEMBER,
      ),
    ).rejects.toThrow();
    expect(repository.write).not.toHaveBeenCalled();
  });

  it('rejects missing exact TeamMember membership without inferring another membership', async () => {
    const { provider, repository } = subject({
      ...snapshot(State.TEAM_ASSIGNED, {
        DIVISION: 'division-a',
        TEAM: 'team-a',
      }),
      target: null,
    });
    await expect(
      assign(provider, Level.MEMBER, WorkflowActionCode.WR_ASSIGN_MEMBER),
    ).rejects.toThrow();
    expect(repository.write).not.toHaveBeenCalled();
  });

  it('requires the exact permission and active UserRole grant', async () => {
    const { provider, repository } = subject();
    const invalid = actor(WorkflowActionCode.VIEW_WORK_REQUEST);
    await expect(
      provider.division('request-a', { divisionId: 'division-a' }, invalid),
    ).rejects.toThrow();
    expect(repository.write).not.toHaveBeenCalled();
  });

  it('enforces TEAM scope through the exact boundTeamId with no fallback', async () => {
    const { provider, repository, scopes } = subject(
      snapshot(State.TEAM_ASSIGNED, { DIVISION: 'division-a', TEAM: 'team-a' }),
    );
    scopes.resolve.mockReturnValue({
      isSystemRole: false,
      customScope: 'team',
      boundTeamId: 'team-b',
    });
    await expect(
      assign(
        provider,
        Level.MEMBER,
        WorkflowActionCode.WR_ASSIGN_MEMBER,
        undefined,
        'team',
      ),
    ).rejects.toThrow();
    expect(repository.write).not.toHaveBeenCalled();
  });

  it.each([
    [
      Level.DIVISION,
      State.DIVISION_ASSIGNED,
      { DIVISION: 'target-a' },
      WorkflowActionCode.WR_ASSIGN_DIVISION,
    ],
    [
      Level.TEAM,
      State.TEAM_ASSIGNED,
      { DIVISION: 'division-a', TEAM: 'target-a' },
      WorkflowActionCode.WR_ASSIGN_TEAM,
    ],
    [
      Level.MEMBER,
      State.MEMBER_ASSIGNED,
      { DIVISION: 'division-a', TEAM: 'team-a', MEMBER: 'target-a' },
      WorkflowActionCode.WR_ASSIGN_MEMBER,
    ],
  ])(
    'rejects a same-target %s retry without replacing history',
    async (level, state, active, permission) => {
      const { provider, repository } = subject(snapshot(state, active));
      await expect(assign(provider, level, permission)).rejects.toThrow(
        'already assigned to this target',
      );
      expect(repository.write).not.toHaveBeenCalled();
    },
  );

  it('rejects a repeated assignment idempotency key before writing history', async () => {
    const { provider, repository } = subject();
    repository.findByIdempotencyKey = jest
      .fn()
      .mockResolvedValue({ id: 'event-a' });
    await expect(
      RequestContext.run({ requestId: 'retry-key', tenantId: 'tenant-a' }, () =>
        provider.division(
          'request-a',
          { divisionId: 'target-a' },
          actor(WorkflowActionCode.WR_ASSIGN_DIVISION),
        ),
      ),
    ).rejects.toThrow('already been applied');
    expect(repository.write).not.toHaveBeenCalled();
  });

  it('enqueues the assignment transition fact in the assignment transaction', async () => {
    const { provider, outbox } = subject();
    await assign(
      provider,
      Level.DIVISION,
      WorkflowActionCode.WR_ASSIGN_DIVISION,
    );
    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
  });
});

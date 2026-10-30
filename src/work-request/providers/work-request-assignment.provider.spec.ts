import {
  PermissionCode,
  WorkflowActionCode,
  WorkRequestV1AssignmentLevelCode as Level,
  WorkRequestV1StateCode as State,
} from '../../generated/prisma/client';
import { RequestContext } from '../../common/context/request-context';
import { WorkRequestAssignmentProvider } from './work-request-assignment.provider';
import { getFinalPermissionForWorkRequestAction } from './work-request-final-permission.mapper';

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
      permissionCodes: Object.values(PermissionCode),
    },
  });
  const actor = (
    permission: WorkflowActionCode,
    customScope: string | null = null,
    withMember = true,
  ) =>
    ({
      id: 'actor-a',
      boundTeamId: customScope === 'team' ? 'team-a' : null,
      role: {
        isSystemRole: customScope === null,
        customScope,
        systemRole: { systemCode: 'tenant_super_admin' },
        userRolesByRoleId: [
          { teamId: customScope === 'team' ? 'team-a' : null },
        ],
        rolePermissions: [
          {
            revokedAt: null,
            permission: {
              code: getFinalPermissionForWorkRequestAction(permission),
            },
          },
        ],
      },
      member: withMember
        ? {
            id: 'member-a',
            companyId: 'company-a',
            isActive: true,
            company: { isActive: true },
            divisionLeadsByMemberId: [{ divisionId: 'division-a' }],
          }
        : null,
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
    const outbox = { enqueue: jest.fn() };
    const reads = { find: jest.fn().mockResolvedValue({ id: 'request-a' }) };
    const provider = new WorkRequestAssignmentProvider(
      repository as never,
      { execute: (work: () => Promise<unknown>) => work() } as never,
      reads as never,
      { history: jest.fn() },
      outbox,
    );
    return { provider, repository, outbox, reads };
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

  it('rejects an inactive or cross-company assignment target', async () => {
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
    'allows tenant_super_admin without a Member to route %s with its exact permission',
    async (level, state, active, permission) => {
      const { provider, repository } = subject(snapshot(state, active));
      const admin = actor(permission, null, false);
      await RequestContext.run(
        { requestId: 'request-a', tenantId: 'tenant-a' },
        () => {
          if (level === Level.DIVISION)
            return provider.division(
              'request-a',
              { divisionId: 'target-a' },
              admin,
            );
          if (level === Level.TEAM)
            return provider.team('request-a', { teamId: 'target-a' }, admin);
          return provider.member('request-a', { memberId: 'target-a' }, admin);
        },
      );
      expect(repository.write).toHaveBeenCalledTimes(1);
    },
  );

  it('denies tenant_super_admin without the exact routing permission', async () => {
    const { provider, repository } = subject();
    await expect(
      provider.division(
        'request-a',
        { divisionId: 'target-a' },
        actor(WorkflowActionCode.VIEW_WORK_REQUEST, null, false),
      ),
    ).rejects.toThrow("You don't have permission");
    expect(repository.write).not.toHaveBeenCalled();
  });

  it('preserves parent-company and state/prerequisite validation for tenant_super_admin routing', async () => {
    const wrongCompany = subject({
      ...snapshot(State.CREATED),
      target: { ...snapshot(State.CREATED).target, companyId: 'company-b' },
    });
    await expect(
      wrongCompany.provider.division(
        'request-a',
        { divisionId: 'target-a' },
        actor(WorkflowActionCode.WR_ASSIGN_DIVISION, null, false),
      ),
    ).rejects.toThrow('outside the Work Request organization');
    expect(wrongCompany.repository.write).not.toHaveBeenCalled();

    const wrongState = subject(snapshot(State.CREATED));
    await expect(
      wrongState.provider.team(
        'request-a',
        { teamId: 'target-a' },
        actor(WorkflowActionCode.WR_ASSIGN_TEAM, null, false),
      ),
    ).rejects.toThrow('not in a valid assignment state');
    expect(wrongState.repository.write).not.toHaveBeenCalled();
  });

  it('denies a missing or foreign-tenant Work Request before routing authorization', async () => {
    const { provider, repository } = subject(null);
    await expect(
      provider.division(
        'foreign-request',
        { divisionId: 'target-a' },
        actor(WorkflowActionCode.WR_ASSIGN_DIVISION, null, false),
      ),
    ).rejects.toThrow('Work Request was not found');
    expect(repository.write).not.toHaveBeenCalled();
  });

  it('denies a caller who has the assignment permission but cannot see the Work Request', async () => {
    const { provider, repository, reads } = subject();
    reads.find.mockResolvedValueOnce(null);
    await expect(
      provider.division(
        'request-a',
        { divisionId: 'target-a' },
        actor(WorkflowActionCode.WR_ASSIGN_DIVISION),
      ),
    ).rejects.toThrow('Work Request was not found');
    expect(repository.prepare).not.toHaveBeenCalled();
    expect(repository.write).not.toHaveBeenCalled();
  });

  it('maps assignment history to the explicit public response shape', async () => {
    const history = jest.fn().mockResolvedValue([
      {
        id: 'assignment-a',
        level: Level.TEAM,
        divisionId: 'division-a',
        teamId: 'team-a',
        memberId: null,
        assignedAt: new Date('2026-10-07T00:00:00.000Z'),
        unassignedAt: null,
        replacedAt: null,
        note: 'Route to team',
        member: null,
        assignedByActor: { id: 'actor-a', label: 'Coordinator' },
        tenantId: 'must-not-leak',
        workRequestId: 'must-not-leak',
        assignedByActorId: 'must-not-leak',
      },
    ]);
    const provider = new WorkRequestAssignmentProvider(
      {} as never,
      { execute: (work: () => Promise<unknown>) => work() } as never,
      { find: jest.fn().mockResolvedValue({ id: 'request-a' }) } as never,
      { history },
      {} as never,
    );

    await expect(provider.history('request-a', {} as never)).resolves.toEqual([
      {
        id: 'assignment-a',
        level: Level.TEAM,
        divisionId: 'division-a',
        teamId: 'team-a',
        memberId: null,
        assignedAt: new Date('2026-10-07T00:00:00.000Z'),
        unassignedAt: null,
        replacedAt: null,
        note: 'Route to team',
        assignee: null,
        assignedBy: { id: 'actor-a', label: 'Coordinator' },
      },
    ]);
  });

  it.each([Level.MEMBER, Level.CHECKING, Level.APPROVAL, Level.FINAL_REVIEW])(
    'maps the %s target to the safe assignee display projection',
    async (level) => {
      const history = jest.fn().mockResolvedValue([
        {
          id: 'assignment-a',
          level,
          divisionId: null,
          teamId: null,
          memberId: 'member-a',
          assignedAt: new Date('2026-10-15T00:00:00.000Z'),
          unassignedAt: null,
          replacedAt: null,
          note: null,
          member: { id: 'member-a', name: 'Safe Member Name' },
          assignedByActor: { id: 'actor-a', label: 'Coordinator' },
        },
      ]);
      const provider = new WorkRequestAssignmentProvider(
        {} as never,
        { execute: (work: () => Promise<unknown>) => work() } as never,
        { find: jest.fn().mockResolvedValue({ id: 'request-a' }) } as never,
        { history },
        {} as never,
      );

      await expect(provider.history('request-a', {} as never)).resolves.toEqual([
        expect.objectContaining({
          memberId: 'member-a',
          assignee: { id: 'member-a', label: 'Safe Member Name' },
          assignedBy: { id: 'actor-a', label: 'Coordinator' },
        }),
      ]);
    },
  );

  it.each([Level.CHECKING, Level.APPROVAL, Level.FINAL_REVIEW])(
    'assigns %s independently with ASSIGN_REVIEWER',
    async (level) => {
      const { provider, repository } = subject(snapshot(State.MEMBER_ASSIGNED));
      const reviewerActor = {
        ...actor(WorkflowActionCode.WR_ASSIGN_MEMBER),
        role: {
          ...actor(WorkflowActionCode.WR_ASSIGN_MEMBER).role,
          rolePermissions: [
            {
              revokedAt: null,
              permission: { code: PermissionCode.ASSIGN_REVIEWER },
            },
          ],
        },
      } as never;
      await RequestContext.run(
        { requestId: 'request-a', tenantId: 'tenant-a' },
        () =>
          provider.reviewer(
            'request-a',
            { memberId: 'target-a', level },
            reviewerActor,
          ),
      );
      expect(repository.write).toHaveBeenCalledWith(
        expect.objectContaining({
          level,
          resultingState: State.MEMBER_ASSIGNED,
        }),
      );
    },
  );

  it.each([
    [Level.CHECKING, [PermissionCode.VIEW_WORK_REQUEST]],
    [
      Level.APPROVAL,
      [
        PermissionCode.VIEW_WORK_REQUEST,
        PermissionCode.APPROVE_WORK_REQUEST_REVIEW,
      ],
    ],
    [
      Level.FINAL_REVIEW,
      [
        PermissionCode.VIEW_WORK_REQUEST,
        PermissionCode.REQUEST_WORK_REQUEST_REVISION,
      ],
    ],
  ])(
    'rejects %s assignment when the target lacks mandatory capabilities',
    async (level, capabilities) => {
      const prepared = snapshot(State.MEMBER_ASSIGNED);
      prepared.target.permissionCodes = capabilities;
      const { provider, repository } = subject(prepared);
      const reviewerActor = {
        ...actor(WorkflowActionCode.WR_ASSIGN_MEMBER),
        role: {
          ...actor(WorkflowActionCode.WR_ASSIGN_MEMBER).role,
          rolePermissions: [
            {
              revokedAt: null,
              permission: { code: PermissionCode.ASSIGN_REVIEWER },
            },
          ],
        },
      } as never;
      await expect(
        RequestContext.run(
          { requestId: 'request-a', tenantId: 'tenant-a' },
          () =>
            provider.reviewer(
              'request-a',
              { memberId: 'target-a', level },
              reviewerActor,
            ),
        ),
      ).rejects.toThrow('lacks required capabilities');
      expect(repository.write).not.toHaveBeenCalled();
    },
  );

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

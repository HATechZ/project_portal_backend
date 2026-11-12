import { RequestContext } from '../../common/context/request-context';
import { WorkRequestExecutionRepository } from './work-request-execution.repository';

describe('sequential Team completion', () => {
  const at = new Date('2026-01-01T00:00:00Z');
  const matching = <T extends object>(value: T): T =>
    expect.objectContaining(value) as T;
  const anyDate = expect.any(Date) as unknown as Date;
  const context = <T>(work: () => Promise<T>) =>
    RequestContext.run({ requestId: 'team-test', tenantId: 'tenant-a' }, work);
  const makeRepository = (db: object) =>
    new WorkRequestExecutionRepository({
      execute: (work: (executor: never) => Promise<unknown>) =>
        work(db as never),
    } as never);
  const step = () => ({
    id: 'team-a',
    ordinal: 1,
    routeId: 'route-a',
    divisionCycleId: 'cycle-a',
    team: { leadMemberId: 'lead-a' },
    divisionCycle: { completedAt: null },
    route: { projection: { teamStepId: 'team-a', openRevisionId: null } },
  });
  const database = (next: object | null = null) => ({
    workRequestTeamStep: {
      findFirst: jest
        .fn()
        .mockResolvedValueOnce(step())
        .mockResolvedValueOnce(next),
      update: jest.fn(),
    },
    workRequestMemberStep: { count: jest.fn().mockResolvedValue(0) },
    workRequestDivisionCycle: { update: jest.fn() },
    workRequestRouteProjection: { update: jest.fn() },
    workRequestRouteEvent: { create: jest.fn() },
  });
  const cycle = (
    members: object[],
    projection = {
      teamStepId: 'team-a',
      openRevisionId: null as string | null,
    },
  ) => ({
    id: 'cycle-a',
    completedAt: null,
    routeStep: {
      divisionId: 'division-a',
      division: { id: 'division-a', name: 'Division' },
    },
    route: { projection },
    teamSteps: [
      {
        id: 'team-a',
        activatedAt: at,
        completedAt: null,
        team: { leadMemberId: 'lead-a' },
        memberSteps: members,
      },
      {
        id: 'team-b',
        activatedAt: null,
        completedAt: null,
        team: { leadMemberId: 'lead-b' },
        memberSteps: [],
      },
    ],
  });
  async function actions(source: object, member: string) {
    const db = {
      workRequestDivisionCycle: {
        findFirst: jest.fn().mockResolvedValue(source),
      },
      divisionLead: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    return (
      await context(() =>
        makeRepository(db).internalCycle('request-a', 'cycle-a', member),
      )
    ).availableActions;
  }

  it('offers completion to the current lead with zero members or after all members submit', async () => {
    await expect(actions(cycle([]), 'lead-a')).resolves.toContain(
      'COMPLETE_TEAM_STEP',
    );
    await expect(
      actions(cycle([{ memberId: 'member-a', submittedAt: at }]), 'lead-a'),
    ).resolves.toContain('COMPLETE_TEAM_STEP');
    await expect(
      actions(cycle([{ memberId: 'member-a', submittedAt: null }]), 'lead-a'),
    ).resolves.not.toContain('COMPLETE_TEAM_STEP');
    await expect(actions(cycle([]), 'lead-b')).resolves.not.toContain(
      'COMPLETE_TEAM_STEP',
    );
    await expect(
      actions(
        cycle([], { teamStepId: 'other', openRevisionId: null }),
        'lead-a',
      ),
    ).resolves.not.toContain('COMPLETE_TEAM_STEP');
    await expect(
      actions(
        cycle([], { teamStepId: 'team-a', openRevisionId: 'revision' }),
        'lead-a',
      ),
    ).resolves.not.toContain('COMPLETE_TEAM_STEP');
  });

  it('completes the current Team once and activates only its next Team', async () => {
    const db = database({ id: 'team-b', activatedAt: null, completedAt: null });
    const repository = makeRepository(db);
    jest.spyOn(repository, 'internalCycle').mockResolvedValue({} as never);
    await context(() =>
      repository.completeTeamStep('request-a', 'team-a', 'actor-a', 'lead-a'),
    );
    expect(db.workRequestTeamStep.update).toHaveBeenCalledTimes(2);
    expect(db.workRequestTeamStep.update).toHaveBeenNthCalledWith(
      1,
      matching({
        where: { id: 'team-a' },
        data: { completedAt: anyDate },
      }),
    );
    expect(db.workRequestTeamStep.update).toHaveBeenNthCalledWith(
      2,
      matching({
        where: { id: 'team-b' },
        data: { activatedAt: anyDate },
      }),
    );
    expect(db.workRequestRouteProjection.update).toHaveBeenCalledWith(
      matching({
        data: matching({
          teamStepId: 'team-b',
          memberStepId: null,
        }),
      }),
    );
    expect(db.workRequestDivisionCycle.update).not.toHaveBeenCalled();
    expect(db.workRequestRouteEvent.create).toHaveBeenCalledTimes(1);
  });

  it('returns the final Team to Division responsibility without advancing the route', async () => {
    const db = database();
    const repository = makeRepository(db);
    jest.spyOn(repository, 'internalCycle').mockResolvedValue({} as never);
    await context(() =>
      repository.completeTeamStep('request-a', 'team-a', 'actor-a', 'lead-a'),
    );
    expect(db.workRequestDivisionCycle.update).toHaveBeenCalledTimes(1);
    expect(db.workRequestRouteProjection.update).toHaveBeenCalledWith(
      matching({
        data: matching({ teamStepId: null, memberStepId: null }),
      }),
    );
    expect(
      (
        db.workRequestRouteProjection.update.mock.calls as unknown as Array<
          [{ data: Record<string, unknown> }]
        >
      )[0][0].data,
    ).not.toHaveProperty('routeStepId');
    expect(db.workRequestRouteEvent.create).toHaveBeenCalledWith(
      matching({
        data: matching({ action: 'DIVISION_CYCLE_COMPLETED' }),
      }),
    );
  });

  it('rejects another lead, pending members, and an open revision before writes', async () => {
    for (const reason of ['lead', 'pending', 'revision']) {
      const db = database();
      if (reason === 'pending')
        db.workRequestMemberStep.count.mockResolvedValue(1);
      if (reason === 'revision')
        db.workRequestTeamStep.findFirst.mockReset().mockResolvedValue({
          ...step(),
          route: {
            projection: { teamStepId: 'team-a', openRevisionId: 'revision' },
          },
        });
      await expect(
        context(() =>
          makeRepository(db).completeTeamStep(
            'request-a',
            'team-a',
            'actor',
            reason === 'lead' ? 'lead-b' : 'lead-a',
          ),
        ),
      ).rejects.toBeDefined();
      expect(db.workRequestTeamStep.update).not.toHaveBeenCalled();
    }
  });

  it('rejects completed or future steps and a previously activated successor', async () => {
    for (const stale of [
      null,
      { ...step(), route: { projection: { teamStepId: 'team-b' } } },
    ]) {
      const db = database();
      db.workRequestTeamStep.findFirst.mockReset().mockResolvedValue(stale);
      await expect(
        context(() =>
          makeRepository(db).completeTeamStep(
            'request-a',
            'team-a',
            'actor',
            'lead-a',
          ),
        ),
      ).rejects.toMatchObject({ status: 409 });
      expect(db.workRequestTeamStep.update).not.toHaveBeenCalled();
    }
    const db = database({ id: 'team-b', activatedAt: at, completedAt: null });
    await expect(
      context(() =>
        makeRepository(db).completeTeamStep(
          'request-a',
          'team-a',
          'actor',
          'lead-a',
        ),
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(db.workRequestRouteEvent.create).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'appends an end Member in order and activates it only when the previous sequence has finished: %s',
    async (finished) => {
      const db = {
        workRequestTeamStep: {
          findFirst: jest.fn().mockResolvedValue({
            ...step(),
            teamId: 'team-id',
            route: {
              projection: {
                teamStepId: 'team-a',
                memberStepId: finished ? null : 'member-b',
              },
            },
          }),
        },
        teamMember: {
          findMany: jest.fn().mockResolvedValue([{ memberId: 'member-c' }]),
        },
        workRequestMemberStep: {
          findFirst: jest.fn().mockResolvedValue({ ordinal: 2 }),
          count: jest.fn().mockResolvedValue(0),
          create: jest.fn(),
        },
        workRequestRouteProjection: { update: jest.fn() },
        workRequestRouteEvent: { create: jest.fn() },
      };
      const repository = makeRepository(db);
      jest.spyOn(repository, 'internalCycle').mockResolvedValue({} as never);
      await context(() =>
        repository.appendMemberStep(
          'request-a',
          'team-a',
          'member-c',
          'actor',
          'lead-a',
        ),
      );
      expect(db.workRequestMemberStep.create).toHaveBeenCalledWith(
        matching({
          data: matching({
            ordinal: 3,
            memberId: 'member-c',
            activatedAt: finished ? anyDate : null,
          }),
        }),
      );
      expect(db.workRequestRouteProjection.update).toHaveBeenCalledTimes(
        finished ? 1 : 0,
      );
    },
  );
});

import { RequestContext } from '../../common/context/request-context';
import { WorkRequestInfoRepository } from './work-request-info.repository';

type Pair = { requestedByActorId: string; targetActorId: string };
type PairWhere = {
  tenantId: string;
  workRequestId: string;
  OR: ({ requestedByActorId: string } | { targetActorId: string })[];
};
type ProfileQuery = {
  where: {
    tenantId: string;
    isActive: boolean;
    clientContact?: unknown;
    member?: { is?: { id?: { in?: string[] } } };
    id?: { in?: string[] };
  };
  select: {
    member: {
      select: {
        designation: unknown;
        teamMembersByMemberId: { where: unknown };
        teamsByLeadMemberId: { where: unknown };
        divisionLeadsByMemberId: { where: unknown };
      };
    };
  };
};
type DivisionQuery = {
  where: { tenantId: string; divisionId?: { in: string[] } };
};
type TeamQuery = {
  where: {
    tenantId: string;
    memberId?: string;
    teamId: { in: string[] };
    leftAt?: null;
    member?: { is?: { isActive?: boolean } };
  };
};

describe('information history isolation', () => {
  it('scopes relationship and history queries to the tenant, request and exact actor', async () => {
    const rows = [
      {
        tenantId: 'tenant-a',
        workRequestId: 'request-a',
        requestedByActorId: 'actor-a',
        targetActorId: 'actor-b',
      },
      {
        tenantId: 'tenant-a',
        workRequestId: 'request-a',
        requestedByActorId: 'actor-b',
        targetActorId: 'actor-a',
      },
      {
        tenantId: 'tenant-a',
        workRequestId: 'request-a',
        requestedByActorId: 'actor-b',
        targetActorId: 'actor-c',
      },
      {
        tenantId: 'tenant-b',
        workRequestId: 'request-a',
        requestedByActorId: 'actor-a',
        targetActorId: 'actor-b',
      },
      {
        tenantId: 'tenant-a',
        workRequestId: 'request-b',
        requestedByActorId: 'actor-a',
        targetActorId: 'actor-b',
      },
    ];
    const matches = (where: PairWhere) =>
      rows.filter(
        (row) =>
          row.tenantId === where.tenantId &&
          row.workRequestId === where.workRequestId &&
          where.OR.some((condition) =>
            'requestedByActorId' in condition
              ? row.requestedByActorId === condition.requestedByActorId
              : row.targetActorId === condition.targetActorId,
          ),
      );
    const db = {
      workRequestV1InfoRequest: {
        findFirst: jest.fn(
          ({ where }: { where: PairWhere }) => matches(where)[0] ?? null,
        ),
        findMany: jest.fn(({ where }: { where: PairWhere }) => matches(where)),
      },
    };
    const repository = new WorkRequestInfoRepository({
      execute: (fn: (db: unknown) => unknown) => fn(db),
    } as never);
    const context = <T>(tenantId: string, fn: () => T) =>
      RequestContext.run({ requestId: 'test', tenantId }, fn);
    const result = await context('tenant-a', () =>
      repository.history('request-a', 'actor-a'),
    );
    expect(result).toEqual(rows.slice(0, 2));
    expect(
      await context('tenant-a', () =>
        repository.hasInfoRelationship('request-b', 'actor-c'),
      ),
    ).toBeNull();
    expect(
      await context('tenant-b', () =>
        repository.hasInfoRelationship('request-b', 'actor-a'),
      ),
    ).toBeNull();
    expect(db.workRequestV1InfoRequest.findMany.mock.calls[0][0].where).toEqual(
      {
        tenantId: 'tenant-a',
        workRequestId: 'request-a',
        OR: [{ requestedByActorId: 'actor-a' }, { targetActorId: 'actor-a' }],
      },
    );
  });
});

describe('information recipient route scope', () => {
  const route = {
    originatingDivisionId: 'origin',
    responsibleOriginatingLead: {
      memberId: 'origin-lead',
      revokedAt: null,
      member: { isActive: true },
      division: { isActive: true },
    },
    projection: {
      routeVersionId: 'current',
      routeStepId: 'active',
      divisionCycleId: 'cycle-a',
    },
    divisionCycles: [
      {
        id: 'cycle-a',
        routeStep: { divisionId: 'origin' },
        teamSteps: [],
      },
    ],
    steps: [
      {
        id: 'active',
        routeVersionId: 'old',
        divisionId: 'origin',
        activatedAt: new Date(),
      },
      {
        id: 'previous',
        routeVersionId: 'old',
        divisionId: 'previous',
        activatedAt: new Date(),
      },
      {
        id: 'removed',
        routeVersionId: 'old',
        divisionId: 'removed',
        activatedAt: null,
      },
      {
        id: 'future',
        routeVersionId: 'current',
        divisionId: 'future',
        activatedAt: null,
      },
    ],
  };
  const setup = (memberId: string) => {
    const db = {
      workRequestV1: {
        findFirst: jest.fn().mockResolvedValue({
          bid: { clientId: 'client', client: { companyId: 'company' } },
          directProject: null,
          route,
        }),
      },
      workRequestRoute: { findFirst: jest.fn().mockResolvedValue(route) },
      actorProfile: {
        findFirst: jest.fn().mockResolvedValue({
          memberId,
          clientContactId: null,
          role: { customScope: 'division' },
        }),
        findMany: jest
          .fn<Promise<unknown[]>, [ProfileQuery]>()
          .mockResolvedValue([]),
      },
      divisionLead: {
        findFirst: jest
          .fn<Promise<{ id: string }>, [DivisionQuery]>()
          .mockResolvedValue({ id: 'lead' }),
        findMany: jest.fn().mockResolvedValue([{ memberId: 'other-lead' }]),
      },
      workRequestMemberStep: { findMany: jest.fn().mockResolvedValue([]) },
      teamMember: { findMany: jest.fn().mockResolvedValue([]) },
      workRequestV1InfoRequest: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const repository = new WorkRequestInfoRepository({
      execute: (fn: (db: unknown) => unknown) => fn(db),
    } as never);
    return { repository, db };
  };
  const context = <T>(fn: () => T) =>
    RequestContext.run({ requestId: 'test', tenantId: 'tenant' }, fn);

  it('gives the responsible originating Lead only Client and Division Lead policy categories', async () => {
    const { repository, db } = setup('origin-lead');
    await context(() => repository.eligibleRecipients('request', 'actor'));
    expect(db.teamMember.findMany).not.toHaveBeenCalled();
    expect(
      db.actorProfile.findMany.mock.calls.some(
        ([query]) => query.where.clientContact,
      ),
    ).toBe(true);
    expect(
      db.actorProfile.findMany.mock.calls.some(([query]) => query.where.member),
    ).toBe(true);
  });

  it('does not grant a non-originating Division Lead Client recipients', async () => {
    const { repository, db } = setup('other-lead');
    await context(() => repository.eligibleRecipients('request', 'actor'));
    expect(
      db.actorProfile.findMany.mock.calls.some(
        ([query]) => query.where.clientContact,
      ),
    ).toBe(false);
  });

  it('permits an active addressed route Lead to respond without granting unrelated Division access', async () => {
    const { repository, db } = setup('origin-lead');
    await expect(
      context(() => repository.isActiveRouteLead('request', 'lead')),
    ).resolves.toBe(true);
    expect(
      db.divisionLead.findFirst.mock.calls[0][0].where.divisionId?.in,
    ).toEqual(['origin', 'previous', 'future']);
    expect(db.divisionLead.findFirst.mock.calls[0][0].where.tenantId).toBe(
      'tenant',
    );
  });
});

describe('information recipient approved Request Info matrix', () => {
  const context = <T>(fn: () => T) =>
    RequestContext.run({ requestId: 'matrix', tenantId: 'tenant-a' }, fn);

  const profile = (id: string) => ({
    id,
    label: id,
    memberId: id,
    clientContactId: null,
  });
  const setup = (
    requesterMemberId: string,
    divisionLead = false,
    reciprocal: Pair[] = [],
  ) => {
    const db = {
      workRequestV1: {
        findFirst: jest.fn(
          (_query?: { where: { id: string; tenantId: string } }) => {
            void _query;
            return Promise.resolve({
              bid: { clientId: 'client-a', client: { companyId: 'company-a' } },
              directProject: null,
              responsibilityHistory: [
                {
                  actorProfileId: 'division-b-lead',
                  responsibilityType: 'DIVISION',
                  divisionCycleId: 'cycle-b',
                  teamStepId: null,
                  sourceMemberId: 'division-b-lead',
                  sourceUserId: 'user-b',
                  sourceRoleId: 'role-b',
                  actorProfile: {
                    memberId: 'division-b-lead',
                    userId: 'user-b',
                    roleId: 'role-b',
                  },
                },
              ],
              route: {
                originatingDivisionId: 'division-c',
                responsibleOriginatingLead: {
                  memberId: 'origin-lead',
                  revokedAt: null,
                  member: { isActive: true },
                  division: { isActive: true },
                },
                projection: {
                  divisionCycleId: 'cycle-a',
                  routeVersionId: 'v1',
                  routeStepId: 'route-a',
                },
                steps: [
                  {
                    id: 'route-a',
                    divisionId: 'division-a',
                    routeVersionId: 'v1',
                    activatedAt: new Date(),
                  },
                  {
                    id: 'route-future',
                    divisionId: 'division-future',
                    routeVersionId: 'v1',
                    activatedAt: null,
                  },
                  {
                    id: 'removed',
                    divisionId: 'division-unrelated',
                    routeVersionId: 'old',
                    activatedAt: null,
                  },
                ],
                divisionCycles: [
                  {
                    id: 'cycle-a',
                    completedAt: null as Date | null,
                    routeStep: { divisionId: 'division-a' },
                    teamSteps: [
                      {
                        id: 'step-a',
                        teamId: 'team-a',
                        completedAt: null as Date | null,
                        memberSteps: [
                          { memberId: 'member-a' },
                          { memberId: 'member-b' },
                        ],
                        team: {
                          divisionId: 'division-a',
                          leadMemberId: 'team-a-lead',
                          isActive: true,
                        },
                      },
                      {
                        id: 'step-b',
                        teamId: 'team-b',
                        completedAt: null as Date | null,
                        memberSteps: [],
                        team: {
                          divisionId: 'division-a',
                          leadMemberId: 'team-b-lead',
                          isActive: true,
                        },
                      },
                      {
                        id: 'step-other',
                        teamId: 'team-other',
                        completedAt: null as Date | null,
                        memberSteps: [],
                        team: {
                          divisionId: 'division-b',
                          leadMemberId: 'other-team-lead',
                          isActive: true,
                        },
                      },
                    ],
                  },
                  {
                    id: 'cycle-b',
                    routeStep: { divisionId: 'division-b' },
                    teamSteps: [],
                  },
                ],
              },
            });
          },
        ),
      },
      actorProfile: {
        findFirst: jest.fn().mockResolvedValue({
          memberId: requesterMemberId,
          clientContactId: null,
          role: {
            customScope:
              requesterMemberId === 'member-a'
                ? 'member'
                : requesterMemberId === 'team-a-lead'
                  ? 'team'
                  : 'division',
          },
        }),
        findMany: jest.fn(({ where }: ProfileQuery) => {
          if (where.clientContact)
            return [
              {
                id: 'client-contact',
                label: 'client-contact',
                memberId: null,
                clientContactId: 'contact-a',
              },
            ];
          const ids = where.member?.is?.id?.in ?? where.id?.in ?? [];
          return ids
            .filter((id: string) => id !== requesterMemberId)
            .map(profile);
        }),
      },
      divisionLead: {
        findFirst: jest
          .fn()
          .mockResolvedValue(divisionLead ? { id: 'lead-a' } : null),
        findMany: jest.fn(({ where }: DivisionQuery) => {
          const leads = [
            { memberId: 'origin-lead', divisionId: 'division-c' },
            { memberId: 'division-a-lead', divisionId: 'division-a' },
            { memberId: 'division-b-lead', divisionId: 'division-b' },
            { memberId: 'future-lead', divisionId: 'division-future' },
            { memberId: 'unrelated-lead', divisionId: 'division-unrelated' },
          ];
          const divisionIds = where.divisionId?.in;
          return divisionIds
            ? leads.filter((lead) => divisionIds.includes(lead.divisionId))
            : leads;
        }),
      },
      workRequestMemberStep: {
        findMany: jest
          .fn<
            Promise<{ teamStep: { teamId: string } }[]>,
            [{ where: { tenantId: string; route: unknown; teamStep: unknown } }]
          >()
          .mockResolvedValue(
            requesterMemberId === 'member-a'
              ? [{ teamStep: { teamId: 'team-a' } }]
              : [],
          ),
      },
      teamMember: {
        findMany: jest.fn(({ where }: TeamQuery) =>
          where.memberId
            ? [{ teamId: 'team-a' }]
            : where.teamId.in.includes('team-a')
              ? [
                  { memberId: 'team-a-lead' },
                  { memberId: 'member-a' },
                  { memberId: 'member-b' },
                ]
              : [],
        ),
      },
      workRequestV1InfoRequest: {
        findMany: jest
          .fn<Promise<Pair[]>, [{ where: PairWhere }]>()
          .mockResolvedValue(reciprocal),
      },
    };
    const repository = new WorkRequestInfoRepository({
      execute: (fn: (db: unknown) => unknown) => fn(db),
    } as never);
    return { repository, db };
  };

  it.each([
    [
      'origin-lead',
      false,
      ['client-contact', 'division-a-lead', 'division-b-lead', 'future-lead'],
    ],
    [
      'division-a-lead',
      true,
      [
        'origin-lead',
        'division-b-lead',
        'team-a-lead',
        'team-b-lead',
        'future-lead',
      ],
    ],
    [
      'team-a-lead',
      false,
      ['division-a-lead', 'member-a', 'member-b', 'team-b-lead'],
    ],
    ['member-a', false, ['team-a-lead', 'member-b']],
  ])(
    'returns exactly the approved recipients for %s',
    async (memberId, isDivisionLead, expected) => {
      const { repository } = setup(memberId, isDivisionLead);
      const recipients = await context(() =>
        repository.eligibleRecipients('request-a', 'actor-a'),
      );
      expect(recipients?.map((recipient) => recipient.id).sort()).toEqual(
        [...expected].sort(),
      );
    },
  );

  it('adds only the exact existing same-request counterpart as a reciprocal recipient', async () => {
    const { repository } = setup('member-a', false, [
      { requestedByActorId: 'actor-a', targetActorId: 'reciprocal-a' },
    ]);
    const recipients = await context(() =>
      repository.eligibleRecipients('request-a', 'actor-a'),
    );
    expect(recipients?.map((recipient) => recipient.id).sort()).toEqual(
      ['team-a-lead', 'member-b', 'reciprocal-a'].sort(),
    );
  });

  it('denies unrelated and incompatible-scope callers without a reciprocal pair', async () => {
    const unrelated = setup('unrelated');
    await expect(
      context(() =>
        unrelated.repository.eligibleRecipients('request-a', 'actor-a'),
      ),
    ).resolves.toEqual([]);
    const incompatible = setup('member-a');
    incompatible.db.actorProfile.findFirst.mockResolvedValue({
      memberId: 'member-a',
      clientContactId: null,
      role: { customScope: 'team' },
    });
    await expect(
      context(() =>
        incompatible.repository.eligibleRecipients('request-a', 'actor-a'),
      ),
    ).resolves.toEqual([]);
  });

  it('keeps the same eligible Division recipients at Division End', async () => {
    const { repository, db } = setup('division-a-lead', true);
    const before = await context(() =>
      repository.eligibleRecipients('request-a', 'actor-a'),
    );
    const request = await db.workRequestV1.findFirst();
    const evidence = (
      actorProfileId: string,
      sourceMemberId: string,
      responsibilityType: string,
      teamStepId: string | null,
    ) => ({
      actorProfileId,
      sourceMemberId,
      responsibilityType,
      teamStepId,
      divisionCycleId: 'cycle-a',
      sourceUserId: `user-${actorProfileId}`,
      sourceRoleId: 'role',
      actorProfile: {
        memberId: sourceMemberId,
        userId: `user-${actorProfileId}`,
        roleId: 'role',
      },
    });
    request.route.divisionCycles[0].completedAt = new Date();
    request.route.divisionCycles[0].teamSteps.forEach((step) => {
      step.completedAt = new Date();
    });
    db.workRequestV1.findFirst.mockResolvedValue({
      ...request,
      responsibilityHistory: [
        ...request.responsibilityHistory,
        evidence('actor-a', 'division-a-lead', 'DIVISION', null),
        evidence('team-a-lead', 'team-a-lead', 'TEAM', 'step-a'),
        evidence('team-b-lead', 'team-b-lead', 'TEAM', 'step-b'),
      ],
    });
    const after = await context(() =>
      repository.eligibleRecipients('request-a', 'actor-a'),
    );
    expect(after?.map((item) => item.id).sort()).toEqual(
      before?.map((item) => item.id).sort(),
    );
  });

  it.each(['start', 'team-a', 'team-b', 'division-end'])(
    'resolves assigned Division and Team Leads at %s without responsibility history',
    async (stage) => {
      const { repository, db } = setup('division-a-lead', true);
      const request = await db.workRequestV1.findFirst();
      const cycle = request.route.divisionCycles[0];
      if (stage === 'team-b' || stage === 'division-end')
        cycle.teamSteps[0].completedAt = new Date();
      if (stage === 'division-end') {
        cycle.teamSteps[1].completedAt = new Date();
        cycle.completedAt = new Date();
      }
      request.route.steps.push({
        id: 'origin-final',
        divisionId: 'division-c',
        routeVersionId: 'v1',
        activatedAt: null,
      });
      db.workRequestV1.findFirst.mockResolvedValue({
        ...request,
        responsibilityHistory: [],
      });
      const recipients = await context(() =>
        repository.eligibleRecipients('request-a', 'actor-a'),
      );
      expect(recipients?.map((recipient) => recipient.id).sort()).toEqual(
        [
          'origin-lead',
          'division-b-lead',
          'future-lead',
          'team-a-lead',
          'team-b-lead',
        ].sort(),
      );
    },
  );

  it('resolves a completed Division actor and historical recipients from exact responsibility evidence', async () => {
    const { repository, db } = setup('division-a-lead');
    const request = await db.workRequestV1.findFirst();
    const history = (
      actorProfileId: string,
      responsibilityType: string,
      divisionCycleId: string,
      teamStepId: string | null,
    ) => ({
      actorProfileId,
      responsibilityType,
      divisionCycleId,
      teamStepId,
      sourceMemberId: actorProfileId,
      sourceUserId: `user-${actorProfileId}`,
      sourceRoleId: 'role',
      actorProfile: {
        memberId: actorProfileId,
        userId: `user-${actorProfileId}`,
        roleId: 'role',
      },
    });
    request.route.divisionCycles[0].completedAt = new Date();
    request.route.projection.divisionCycleId = 'cycle-b';
    const callerHistory = history('actor-a', 'DIVISION', 'cycle-a', null);
    callerHistory.sourceMemberId = 'division-a-lead';
    callerHistory.actorProfile.memberId = 'division-a-lead';
    const rebound = history('rebound', 'TEAM', 'cycle-a', 'step-a');
    rebound.actorProfile.memberId = 'replacement-member';
    db.workRequestV1.findFirst.mockResolvedValue({
      ...request,
      responsibilityHistory: [
        callerHistory,
        history('former-team-a', 'TEAM', 'cycle-a', 'step-a'),
        history('former-team-b', 'TEAM', 'cycle-a', 'step-b'),
        history('former-team-a', 'TEAM', 'cycle-a', 'step-a'),
        history('former-division-b', 'DIVISION', 'cycle-b', null),
        history('other-team', 'TEAM', 'cycle-b', 'step-other'),
        rebound,
      ],
    });
    const recipients = await context(() =>
      repository.eligibleRecipients('request-a', 'actor-a'),
    );
    expect(recipients?.map((recipient) => recipient.id).sort()).toEqual(
      [
        'division-b-lead',
        'origin-lead',
        'former-team-a',
        'former-team-b',
        'former-division-b',
        'future-lead',
        'team-a-lead',
        'team-b-lead',
      ].sort(),
    );
    expect(db.divisionLead.findMany.mock.calls[0][0].where).toMatchObject({
      tenantId: 'tenant-a',
      divisionId: {
        in: ['division-c', 'division-a', 'division-b', 'division-future'],
      },
    });
    expect(
      db.actorProfile.findMany.mock.calls.every(
        ([query]) => query.where.tenantId === 'tenant-a',
      ),
    ).toBe(true);
  });

  it('retains Member recipients through Work Request steps after Team membership ends', async () => {
    const { repository, db } = setup('member-a');
    db.teamMember.findMany.mockImplementation(() => []);
    await expect(
      context(() => repository.eligibleRecipients('request-a', 'actor-a')),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'team-a-lead' }),
        expect.objectContaining({ id: 'member-b' }),
      ]),
    );
  });

  it.each(['team-a-lead', 'member-a'])(
    'retains the %s matrix after Team and Division completion',
    async (caller) => {
      const { repository, db } = setup(caller);
      const request = await db.workRequestV1.findFirst();
      const cycle = request.route.divisionCycles[0];
      cycle.completedAt = new Date();
      cycle.teamSteps.forEach((step) => {
        step.completedAt = new Date();
      });
      request.route.projection.divisionCycleId = 'cycle-b';
      const evidence = (id: string, type: string, step: string | null) => ({
        actorProfileId: id,
        responsibilityType: type,
        divisionCycleId: 'cycle-a',
        teamStepId: step,
        sourceMemberId: id === 'actor-a' ? caller : id,
        sourceUserId: `user-${id}`,
        sourceRoleId: 'role',
        actorProfile: {
          memberId: id === 'actor-a' ? caller : id,
          userId: `user-${id}`,
          roleId: 'role',
        },
      });
      db.workRequestV1.findFirst.mockResolvedValue({
        ...request,
        responsibilityHistory: [
          evidence(
            caller === 'team-a-lead' ? 'actor-a' : 'team-a-lead',
            'TEAM',
            'step-a',
          ),
          evidence('team-b-lead', 'TEAM', 'step-b'),
          evidence('division-a-lead', 'DIVISION', null),
        ],
      });
      const result = await context(() =>
        repository.eligibleRecipients('request-a', 'actor-a'),
      );
      expect(result?.map((item) => item.id).sort()).toEqual(
        (caller === 'team-a-lead'
          ? ['division-a-lead', 'team-b-lead', 'member-a', 'member-b']
          : ['team-a-lead', 'member-b']
        ).sort(),
      );
    },
  );

  it('uses tenant, active/revocation, current-cycle, and current-work-request constraints for every relationship source', async () => {
    const { repository, db } = setup('member-a');
    await context(() => repository.eligibleRecipients('request-a', 'actor-a'));
    expect(db.workRequestV1.findFirst.mock.calls[0][0]?.where).toEqual({
      id: 'request-a',
      tenantId: 'tenant-a',
    });
    expect(
      db.workRequestMemberStep.findMany.mock.calls[0][0].where,
    ).toMatchObject({
      tenantId: 'tenant-a',
      route: { is: { workRequestId: 'request-a' } },
      cancelledAt: null,
    });
    expect(
      db.teamMember.findMany.mock.calls.some(
        ([query]) =>
          query.where.tenantId === 'tenant-a' &&
          query.where.leftAt === null &&
          query.where.member?.is?.isActive === true,
      ),
    ).toBe(true);
    expect(
      db.workRequestV1InfoRequest.findMany.mock.calls[0][0].where,
    ).toMatchObject({ tenantId: 'tenant-a', workRequestId: 'request-a' });
    const profileQueries = db.actorProfile.findMany.mock.calls.map(
      ([query]) => query.where,
    );
    expect(
      profileQueries.every(
        (where) => where.tenantId === 'tenant-a' && where.isActive === true,
      ),
    ).toBe(true);
    const selection =
      db.actorProfile.findMany.mock.calls[0][0].select.member.select;
    expect(selection.designation.select).toEqual({ id: true, name: true });
    expect(selection.teamMembersByMemberId.where).toEqual({
      leftAt: null,
      team: { is: { isActive: true } },
    });
    expect(selection.teamsByLeadMemberId.where).toEqual({ isActive: true });
    expect(selection.divisionLeadsByMemberId.where).toEqual({
      revokedAt: null,
      division: { is: { isActive: true } },
    });
  });
});

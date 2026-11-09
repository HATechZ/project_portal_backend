import { RequestContext } from '../../common/context/request-context';
import { WorkRequestInfoRepository } from './work-request-info.repository';

describe('information history isolation', () => {
  it('scopes relationship and history queries to the tenant, request and exact actor', async () => {
    const rows = [
      { tenantId: 'tenant-a', workRequestId: 'request-a', requestedByActorId: 'actor-a', targetActorId: 'actor-b' },
      { tenantId: 'tenant-a', workRequestId: 'request-a', requestedByActorId: 'actor-b', targetActorId: 'actor-a' },
      { tenantId: 'tenant-a', workRequestId: 'request-a', requestedByActorId: 'actor-b', targetActorId: 'actor-c' },
      { tenantId: 'tenant-b', workRequestId: 'request-a', requestedByActorId: 'actor-a', targetActorId: 'actor-b' },
      { tenantId: 'tenant-a', workRequestId: 'request-b', requestedByActorId: 'actor-a', targetActorId: 'actor-b' },
    ];
    const matches = (where: any) => rows.filter((row) => row.tenantId === where.tenantId && row.workRequestId === where.workRequestId && where.OR.some((condition: any) => Object.entries(condition).every(([key, value]) => row[key] === value)));
    const db = { workRequestV1InfoRequest: {
      findFirst: jest.fn(({ where }) => matches(where)[0] ?? null),
      findMany: jest.fn(({ where }) => matches(where)),
    } };
    const repository = new WorkRequestInfoRepository({ execute: (fn: (db: unknown) => unknown) => fn(db) } as never);
    const context = <T>(tenantId: string, fn: () => T) => RequestContext.run({ requestId: 'test', tenantId }, fn);
    const result = await context('tenant-a', () => repository.history('request-a', 'actor-a'));
    expect(result).toEqual(rows.slice(0, 2));
    expect(await context('tenant-a', () => repository.hasInfoRelationship('request-b', 'actor-c'))).toBeNull();
    expect(await context('tenant-b', () => repository.hasInfoRelationship('request-b', 'actor-a'))).toBeNull();
    expect(db.workRequestV1InfoRequest.findMany.mock.calls[0][0].where).toEqual({ tenantId: 'tenant-a', workRequestId: 'request-a', OR: [{ requestedByActorId: 'actor-a' }, { targetActorId: 'actor-a' }] });
  });
});

describe('information recipient route scope', () => {
  const route = {
    originatingDivisionId: 'origin',
    responsibleOriginatingLead: { memberId: 'origin-lead', revokedAt: null, member: { isActive: true }, division: { isActive: true } },
    projection: { routeVersionId: 'current', routeStepId: 'active', divisionCycleId: 'cycle-a' },
    divisionCycles: [{
      id: 'cycle-a',
      routeStep: { divisionId: 'origin' },
      teamSteps: [],
    }],
    steps: [
      { id: 'active', routeVersionId: 'old', divisionId: 'origin', activatedAt: new Date() },
      { id: 'previous', routeVersionId: 'old', divisionId: 'previous', activatedAt: new Date() },
      { id: 'removed', routeVersionId: 'old', divisionId: 'removed', activatedAt: null },
      { id: 'future', routeVersionId: 'current', divisionId: 'future', activatedAt: null },
    ],
  };
  const setup = (memberId: string) => {
    const db = {
      workRequestV1: { findFirst: jest.fn().mockResolvedValue({ bid: { clientId: 'client', client: { companyId: 'company' } }, directProject: null, route }) },
      workRequestRoute: { findFirst: jest.fn().mockResolvedValue(route) },
      actorProfile: { findFirst: jest.fn().mockResolvedValue({ memberId, clientContactId: null }), findMany: jest.fn().mockResolvedValue([]) },
      divisionLead: { findFirst: jest.fn().mockResolvedValue({ id: 'lead' }), findMany: jest.fn().mockResolvedValue([{ memberId: 'other-lead' }]) },
      workRequestMemberStep: { findMany: jest.fn().mockResolvedValue([]) },
      teamMember: { findMany: jest.fn().mockResolvedValue([]) },
      workRequestV1InfoRequest: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const repository = new WorkRequestInfoRepository({ execute: (fn: (db: unknown) => unknown) => fn(db) } as never);
    return { repository, db };
  };
  const context = <T>(fn: () => T) => RequestContext.run({ requestId: 'test', tenantId: 'tenant' }, fn);

  it('gives the responsible originating Lead only Client and Division Lead policy categories', async () => {
    const { repository, db } = setup('origin-lead');
    await context(() => repository.eligibleRecipients('request', 'actor'));
    expect(db.teamMember.findMany).not.toHaveBeenCalled();
    expect(db.actorProfile.findMany.mock.calls.some(([query]: any[]) => query.where.clientContact)).toBe(true);
    expect(db.actorProfile.findMany.mock.calls.some(([query]: any[]) => query.where.member)).toBe(true);
  });

  it('does not grant a non-originating Division Lead Client recipients', async () => {
    const { repository, db } = setup('other-lead');
    await context(() => repository.eligibleRecipients('request', 'actor'));
    expect(db.actorProfile.findMany.mock.calls.some(([query]: any[]) => query.where.clientContact)).toBe(false);
  });

  it('permits an active addressed route Lead to respond without granting unrelated Division access', async () => {
    const { repository, db } = setup('origin-lead');
    await expect(context(() => repository.isActiveRouteLead('request', 'lead'))).resolves.toBe(true);
    expect(db.divisionLead.findFirst.mock.calls[0][0].where.divisionId.in).toEqual(['origin', 'previous', 'future']);
    expect(db.divisionLead.findFirst.mock.calls[0][0].where.tenantId).toBe('tenant');
  });
});

describe('information recipient approved Request Info matrix', () => {
  const context = <T>(fn: () => T) =>
    RequestContext.run({ requestId: 'matrix', tenantId: 'tenant-a' }, fn);

  const profile = (id: string) => ({ id, label: id, memberId: id, clientContactId: null });
  const setup = (requesterMemberId: string, divisionLead = false, reciprocal: any[] = []) => {
    const db = {
      workRequestV1: {
        findFirst: jest.fn().mockResolvedValue({
          bid: { clientId: 'client-a', client: { companyId: 'company-a' } },
          directProject: null,
          route: {
            responsibleOriginatingLead: {
              memberId: 'origin-lead', revokedAt: null,
              member: { isActive: true }, division: { isActive: true },
            },
            projection: { divisionCycleId: 'cycle-a' },
            divisionCycles: [{
              id: 'cycle-a', routeStep: { divisionId: 'division-a' },
              teamSteps: [
                { teamId: 'team-a', team: { divisionId: 'division-a', leadMemberId: 'team-a-lead', isActive: true } },
                { teamId: 'team-b', team: { divisionId: 'division-a', leadMemberId: 'team-b-lead', isActive: true } },
                { teamId: 'team-other', team: { divisionId: 'division-b', leadMemberId: 'other-team-lead', isActive: true } },
              ],
            }],
          },
        }),
      },
      actorProfile: {
        findFirst: jest.fn().mockResolvedValue({ memberId: requesterMemberId, clientContactId: null }),
        findMany: jest.fn().mockImplementation(({ where }: any) => {
          if (where.clientContact) return [{ id: 'client-contact', label: 'client-contact', memberId: null, clientContactId: 'contact-a' }];
          const ids = where.member?.is?.id?.in ?? where.id?.in ?? [];
          return ids.filter((id: string) => id !== requesterMemberId).map(profile);
        }),
      },
      divisionLead: {
        findFirst: jest.fn().mockResolvedValue(divisionLead ? { id: 'lead-a' } : null),
        findMany: jest.fn().mockImplementation(({ where }: any) => {
          const leads = [
            { memberId: 'origin-lead', divisionId: 'division-a' },
            { memberId: 'division-a-lead', divisionId: 'division-a' },
            { memberId: 'division-b-lead', divisionId: 'division-b' },
          ];
          return where.divisionId?.in
            ? leads.filter((lead) => where.divisionId.in.includes(lead.divisionId))
            : leads;
        }),
      },
      workRequestMemberStep: {
        findMany: jest.fn().mockResolvedValue(
          requesterMemberId === 'member-a' ? [{ teamStep: { teamId: 'team-a' } }] : [],
        ),
      },
      teamMember: {
        findMany: jest.fn().mockImplementation(({ where }: any) =>
          where.memberId
            ? [{ teamId: 'team-a' }]
            : where.teamId.in.includes('team-a')
            ? [{ memberId: 'team-a-lead' }, { memberId: 'member-a' }, { memberId: 'member-b' }]
            : [],
        ),
      },
      workRequestV1InfoRequest: { findMany: jest.fn().mockResolvedValue(reciprocal) },
    };
    const repository = new WorkRequestInfoRepository({ execute: (fn: (db: unknown) => unknown) => fn(db) } as never);
    return { repository, db };
  };

  it.each([
    ['origin-lead', false, ['client-contact', 'division-a-lead', 'division-b-lead']],
    ['division-a-lead', true, ['origin-lead', 'division-b-lead', 'team-a-lead', 'team-b-lead']],
    ['team-a-lead', false, ['origin-lead', 'division-a-lead', 'member-a', 'member-b', 'team-b-lead']],
    ['member-a', false, ['team-a-lead', 'member-b']],
  ])('returns exactly the approved recipients for %s', async (memberId, isDivisionLead, expected) => {
    const { repository } = setup(memberId, isDivisionLead);
    const recipients = await context(() => repository.eligibleRecipients('request-a', 'actor-a'));
    expect(recipients?.map((recipient: any) => recipient.id).sort()).toEqual([...expected].sort());
  });

  it('adds only the exact existing same-request counterpart as a reciprocal recipient', async () => {
    const { repository } = setup('member-a', false, [
      { requestedByActorId: 'actor-a', targetActorId: 'reciprocal-a' },
    ]);
    const recipients = await context(() => repository.eligibleRecipients('request-a', 'actor-a'));
    expect(recipients?.map((recipient: any) => recipient.id).sort()).toEqual(
      ['team-a-lead', 'member-b', 'reciprocal-a'].sort(),
    );
  });

  it('does not retain Member recipient access after the current Team membership is revoked', async () => {
    const { repository, db } = setup('member-a');
    db.teamMember.findMany.mockImplementation(({ where }: any) =>
      where.memberId ? [] : [],
    );
    await expect(context(() => repository.eligibleRecipients('request-a', 'actor-a'))).resolves.toEqual([]);
  });

  it('uses tenant, active/revocation, current-cycle, and current-work-request constraints for every relationship source', async () => {
    const { repository, db } = setup('member-a');
    await context(() => repository.eligibleRecipients('request-a', 'actor-a'));
    expect(db.workRequestV1.findFirst.mock.calls[0][0].where).toEqual({ id: 'request-a', tenantId: 'tenant-a' });
    expect(db.workRequestMemberStep.findMany.mock.calls[0][0].where).toMatchObject({ tenantId: 'tenant-a', route: { is: { workRequestId: 'request-a' } }, teamStep: { divisionCycleId: 'cycle-a' } });
    expect(db.teamMember.findMany.mock.calls.some(([query]: any[]) =>
      query.where.tenantId === 'tenant-a' && query.where.leftAt === null && query.where.member?.is?.isActive === true,
    )).toBe(true);
    expect(db.workRequestV1InfoRequest.findMany.mock.calls[0][0].where).toMatchObject({ tenantId: 'tenant-a', workRequestId: 'request-a' });
    const profileQueries = db.actorProfile.findMany.mock.calls.map(([query]: any[]) => query.where);
    expect(profileQueries.every((where: any) => where.tenantId === 'tenant-a' && where.isActive === true)).toBe(true);
    const selection = db.actorProfile.findMany.mock.calls[0][0].select.member.select;
    expect(selection.designation.select).toEqual({ id: true, name: true });
    expect(selection.teamMembersByMemberId.where).toEqual({ leftAt: null, team: { is: { isActive: true } } });
    expect(selection.teamsByLeadMemberId.where).toEqual({ isActive: true });
    expect(selection.divisionLeadsByMemberId.where).toEqual({ revokedAt: null, division: { is: { isActive: true } } });
  });
});

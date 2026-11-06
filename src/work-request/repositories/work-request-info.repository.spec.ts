import { RequestContext } from '../../common/context/request-context';
import { WorkRequestInfoRepository } from './work-request-info.repository';

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

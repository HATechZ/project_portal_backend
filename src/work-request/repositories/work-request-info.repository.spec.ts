import { RequestContext } from '../../common/context/request-context';
import { WorkRequestInfoRepository } from './work-request-info.repository';

describe('information recipient route scope', () => {
  const route = {
    originatingDivisionId: 'origin',
    responsibleOriginatingLead: { memberId: 'origin-lead', revokedAt: null, member: { isActive: true }, division: { isActive: true } },
    projection: { routeVersionId: 'current', routeStepId: 'active' },
    steps: [
      { id: 'active', routeVersionId: 'old', divisionId: 'origin', activatedAt: new Date() },
      { id: 'previous', routeVersionId: 'old', divisionId: 'previous', activatedAt: new Date() },
      { id: 'removed', routeVersionId: 'old', divisionId: 'removed', activatedAt: null },
      { id: 'future', routeVersionId: 'current', divisionId: 'future', activatedAt: null },
    ],
  };
  const setup = (memberId: string) => {
    const db = {
      workRequestV1: { findFirst: jest.fn().mockResolvedValue({ bid: { clientId: 'client', client: { companyId: 'company' } }, directProject: null, assignments: [{ divisionId: 'assigned' }] }) },
      workRequestRoute: { findFirst: jest.fn().mockResolvedValue(route) },
      actorProfile: { findFirst: jest.fn().mockResolvedValue({ memberId }), findMany: jest.fn().mockResolvedValue([]) },
      divisionLead: { findFirst: jest.fn().mockResolvedValue({ id: 'lead' }) },
    };
    const repository = new WorkRequestInfoRepository({ execute: (fn: (db: unknown) => unknown) => fn(db) } as never);
    return { repository, db };
  };
  const context = <T>(fn: () => T) => RequestContext.run({ requestId: 'test', tenantId: 'tenant' }, fn);

  it('includes assigned, current-plan and previously activated Divisions for the responsible Lead only', async () => {
    const { repository, db } = setup('origin-lead');
    await context(() => repository.eligibleRecipients('request', 'actor'));
    const query = db.actorProfile.findMany.mock.calls[0][0];
    expect(query.where.id).toEqual({ not: 'actor' });
    expect(query.where.tenantId).toBe('tenant');
    expect(query.where.OR[1].member.is.divisionLeadsByMemberId.some.divisionId.in).toEqual(['assigned', 'origin', 'previous', 'future']);
  });

  it('does not widen recipient scope for a different requester', async () => {
    const { repository, db } = setup('other-lead');
    await context(() => repository.eligibleRecipients('request', 'actor'));
    expect(db.actorProfile.findMany.mock.calls[0][0].where.OR[1].member.is.divisionLeadsByMemberId.some.divisionId.in).toEqual(['assigned']);
  });

  it('permits an active addressed route Lead to respond without granting unrelated Division access', async () => {
    const { repository, db } = setup('origin-lead');
    await expect(context(() => repository.isActiveRouteLead('request', 'lead'))).resolves.toBe(true);
    expect(db.divisionLead.findFirst.mock.calls[0][0].where.divisionId.in).toEqual(['origin', 'previous', 'future']);
    expect(db.divisionLead.findFirst.mock.calls[0][0].where.tenantId).toBe('tenant');
  });
});

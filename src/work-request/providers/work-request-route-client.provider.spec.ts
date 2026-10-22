import { RequestContext } from '../../common/context/request-context';
import { PermissionCode, WorkRequestRouteReconsiderationDecisionCode as Decision, WorkRequestRouteStepKind as StepKind } from '../../generated/prisma/client';
import { WorkRequestRouteClientProvider } from './work-request-route-client.provider';

describe('WorkRequestRouteClientProvider Phase 7 gateway', () => {
  const context = <T>(work: () => Promise<T>) => RequestContext.run({ tenantId: 'tenant-a', requestId: '11111111-1111-4111-8111-111111111111' }, work);
  const actor = (memberId = 'origin-lead', client = false) => ({
    id: client ? 'client-actor' : 'origin-actor',
    member: client ? null : { id: memberId, isActive: true },
    clientContact: client ? { id: 'contact-a', clientId: 'client-a', isActive: true, client: { isActive: true } } : null,
    role: { customScope: client ? 'client_contact' : 'division', rolePermissions: [
      PermissionCode.SUBMIT_FOR_EXTERNAL_REVIEW, PermissionCode.REQUEST_WORK_REQUEST_REVISION,
      PermissionCode.ACCEPT_FINAL_DELIVERY, PermissionCode.REJECT_FINAL_DELIVERY, PermissionCode.REQUEST_REVISION, PermissionCode.ROUTE_FOR_REVIEW,
    ].map((code) => ({ revokedAt: null, permission: { code, scopeCompatibilities: [{ scope: client ? 'client_contact' : 'division' }] } })) },
  }) as never;
  const route = (step = StepKind.ORIGIN_FINAL_REVIEW) => ({
    responsibleOriginatingLead: { memberId: 'origin-lead' },
    projection: { routeStepId: 'step-a', routeStep: { kind: step } },
    workRequest: { bid: { clientId: 'client-a', client: { companyId: 'company-a' } }, directProject: null, events: [{ resultingState: 'REJECTED' }], clientSubmissions: [] },
  });

  it('requires the exact bound originating lead, not another lead in the same division', async () => {
    const repository = { context: jest.fn().mockResolvedValue(route()), versions: jest.fn() };
    const provider = new WorkRequestRouteClientProvider(repository as never);
    await expect(context(() => provider.submit('request-a', { documentVersionIds: ['version-a'] }, actor('other-lead')))).rejects.toMatchObject({ status: 403 });
    expect(repository.versions).not.toHaveBeenCalled();
  });

  it('does not let a Team-scoped lead exercise originating-gateway authority', async () => {
    const repository = { context: jest.fn().mockResolvedValue(route()), versions: jest.fn() };
    const scopedActor = actor();
    scopedActor.role.customScope = 'team';
    const provider = new WorkRequestRouteClientProvider(repository as never);
    await expect(context(() => provider.submit('request-a', { documentVersionIds: ['version-a'] }, scopedActor))).rejects.toMatchObject({ status: 403 });
    expect(repository.versions).not.toHaveBeenCalled();
  });

  it('requires exact Work Request document versions before creating an immutable package', async () => {
    const repository = { context: jest.fn().mockResolvedValue(route()), versions: jest.fn().mockResolvedValue([]), submit: jest.fn() };
    const provider = new WorkRequestRouteClientProvider(repository as never);
    await expect(context(() => provider.submit('request-a', { documentVersionIds: ['foreign-version'] }, actor()))).rejects.toMatchObject({ status: 400 });
    expect(repository.submit).not.toHaveBeenCalled();
  });

  it('allows only the linked Client contact to decide an active client-tail package', async () => {
    const repository = { context: jest.fn().mockResolvedValue(route(StepKind.CLIENT)), decide: jest.fn().mockResolvedValue({ decision: { id: 'decision-a', decision: 'REQUEST_REVISION', decidedAt: new Date() }, state: 'CLIENT_REVISION_REQUESTED' }) };
    const provider = new WorkRequestRouteClientProvider(repository as never);
    await expect(context(() => provider.decide('request-a', 'submission-a', { decision: 'REQUEST_REVISION', note: 'correct package' }, actor()))).rejects.toMatchObject({ status: 403 });
    await expect(context(() => provider.decide('request-a', 'submission-a', { decision: 'REQUEST_REVISION', note: 'correct package' }, actor('', true)))).resolves.toMatchObject({ decision: 'REQUEST_REVISION' });
  });

  it('allows one exact-origin reconsideration request and a Client accept/deny decision only', async () => {
    const repository = { context: jest.fn().mockResolvedValue(route()), requestReconsideration: jest.fn().mockResolvedValue({ reconsideration: { id: 'reconsideration-a', requestedAt: new Date() } }), decideReconsideration: jest.fn().mockResolvedValue({ decision: { id: 'decision-a', decision: Decision.ACCEPT, decidedAt: new Date() }, reopened: true }) };
    const provider = new WorkRequestRouteClientProvider(repository as never);
    await expect(context(() => provider.requestReconsideration('request-a', 'review rejection', actor()))).resolves.toMatchObject({ id: 'reconsideration-a' });
    await expect(context(() => provider.decideReconsideration('request-a', Decision.ACCEPT, 'reopen', actor('', true)))).resolves.toMatchObject({ reopened: true });
  });

  it('does not let a merely same-tenant internal actor list Client packages', async () => {
    const repository = { context: jest.fn().mockResolvedValue(route(StepKind.CLIENT)), list: jest.fn() };
    const provider = new WorkRequestRouteClientProvider(repository as never);
    await expect(context(() => provider.list('request-a', actor('other-lead')))).rejects.toMatchObject({ status: 403 });
    expect(repository.list).not.toHaveBeenCalled();
  });
});

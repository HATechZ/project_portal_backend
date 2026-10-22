import { RequestContext } from '../../common/context/request-context';
import { WorkRequestRouteClientRepository } from './work-request-route-client.repository';

describe('WorkRequestRouteClientRepository Phase 7 projection integrity', () => {
  const context = <T>(work: () => Promise<T>) => RequestContext.run({ tenantId: 'tenant-a', requestId: 'route-client-test' }, work);
  it('returns a client-revision resubmission to the existing Client tail without rewriting Origin-final history', async () => {
    const stepUpdate = jest.fn();
    const projectionUpdate = jest.fn();
    const db = {
      workRequestRoute: { findFirst: jest.fn().mockResolvedValue({
        id: 'route-a',
        projection: { divisionCycleId: null, routeStep: { id: 'origin-final', kind: 'ORIGIN_FINAL_REVIEW', completedAt: new Date() } },
        steps: [{ id: 'origin-final', kind: 'ORIGIN_FINAL_REVIEW', completedAt: new Date() }, { id: 'client-a', kind: 'CLIENT', activatedAt: new Date() }],
        divisionCycles: [],
        workRequest: { clientSubmissions: [{ decision: { decision: 'REQUEST_REVISION' } }] },
      }) },
      workRequestV1Event: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'event-a' }) },
      workRequestV1ClientSubmission: { count: jest.fn().mockResolvedValue(1), create: jest.fn().mockResolvedValue({ id: 'submission-b', items: [] }) },
      workRequestRouteStep: { update: stepUpdate },
      workRequestRouteProjection: { update: projectionUpdate },
      workRequestRouteEvent: { create: jest.fn() },
    };
    const subject = new WorkRequestRouteClientRepository({ execute: (work: (executor: never) => Promise<unknown>) => work(db as never) } as never);
    await context(() => subject.submit({ workRequestId: 'request-a', actorId: 'actor-a', versionIds: ['version-a'] }));
    expect(stepUpdate).not.toHaveBeenCalled();
    expect(projectionUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ routeStepId: 'client-a' }) }));
  });
});

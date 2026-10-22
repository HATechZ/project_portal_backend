import { RequestContext } from '../../common/context/request-context';
import { WorkRequestRepository } from './work-request.repository';

describe('WorkRequestRepository Phase 3 route guards', () => {
  const context = <T>(work: () => Promise<T>) => RequestContext.run({ requestId: 'route-test', tenantId: 'tenant-a' }, work);
  it('limits the main projection to the exact active responsible lead', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const repository = new WorkRequestRepository({ execute: (work: (db: unknown) => Promise<unknown>) => work({ workRequestRoute: { findFirst } }) } as never);
    await context(() => repository.routeProjection('request-a', 'member-a'));
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ responsibleOriginatingLead: { is: { memberId: 'member-a', revokedAt: null } } }) }));
  });
  it('rejects forward when the supplied step is not the projection current step', async () => {
    const repository = new WorkRequestRepository({ execute: (work: (db: unknown) => Promise<unknown>) => work({ workRequestRoute: { findFirst: jest.fn().mockResolvedValue({ id: 'route-a', projection: { routeStepId: 'current-a', routeVersionId: 'version-a' } }) } }) } as never);
    await expect(context(() => repository.forwardRoute('request-a', 'other-a', 'actor-a', 'member-a'))).rejects.toThrow('WR_ROUTE_POSITION');
  });
  it('rejects stale route-version amendments before mutating route history', async () => {
    const create = jest.fn();
    const repository = new WorkRequestRepository({ execute: (work: (db: unknown) => Promise<unknown>) => work({ workRequestRoute: { findFirst: jest.fn().mockResolvedValue({ id: 'route-a', projection: { routeStepId: 'current-a', routeVersionId: 'version-current' }, versions: [] }) }, workRequestRouteVersion: { create } }) } as never);
    await expect(context(() => repository.amendRoute('request-a', { baseRouteVersionId: 'stale', intermediateDivisionIds: [] }, 'actor-a', 'member-a'))).rejects.toThrow('WR_ROUTE_STALE');
    expect(create).not.toHaveBeenCalled();
  });
  it('does not let normal forward bypass the immutable C1 package gateway', async () => {
    const update = jest.fn();
    const repository = new WorkRequestRepository({ execute: (work: (db: unknown) => Promise<unknown>) => work({
      workRequestRoute: { findFirst: jest.fn().mockResolvedValue({ id: 'route-a', projection: { routeStepId: 'final-a', routeVersionId: 'version-a' } }) },
      workRequestRouteStep: { findFirst: jest.fn()
        .mockResolvedValueOnce({ id: 'final-a', routeId: 'route-a', ordinal: 4, routeVersionId: 'version-a', divisionId: 'origin-a', completedAt: null })
        .mockResolvedValueOnce({ id: 'client-a', kind: 'CLIENT' }), update },
      divisionLead: { findFirst: jest.fn().mockResolvedValue({ id: 'lead-a' }) },
      workRequestDivisionCycle: { findFirst: jest.fn().mockResolvedValue({ completedAt: new Date() }) },
    }) } as never);
    await expect(context(() => repository.forwardRoute('request-a', 'final-a', 'actor-a', 'member-a'))).rejects.toThrow('WR_ROUTE_CLIENT_GATEWAY');
    expect(update).not.toHaveBeenCalled();
  });
});

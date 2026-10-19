import { RequestContext } from '../../common/context/request-context';
import { WorkRequestRepository } from './work-request.repository';

const bidId = '11111111-1111-4111-8111-111111111111';
const projectId = '22222222-2222-4222-8222-222222222222';

describe('WorkRequestRepository parent XOR', () => {
  const repository = new WorkRequestRepository({} as never);

  it.each([
    ['neither parent', undefined, undefined],
    ['both parents', bidId, projectId],
  ])('rejects %s before querying persistence', async (_, bid, project) => {
    const operation = RequestContext.run(
      { requestId: 'request-a', tenantId: 'tenant-a' },
      () => repository.prepareCreate(bid, project, []),
    );

    await expect(operation).rejects.toThrow('WR_PARENT_XOR');
  });

  it('uses the current tenant when looking up a Project parent', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const repository = new WorkRequestRepository({
      execute: (work: (db: unknown) => Promise<unknown>) =>
        work({
          documentCodeOption: { findMany: jest.fn().mockResolvedValue([]) },
          directProject: { findFirst },
        }),
    } as never);

    const operation = RequestContext.run(
      { requestId: 'request-a', tenantId: 'tenant-a' },
      () => repository.prepareCreate(undefined, projectId, []),
    );

    await expect(operation).rejects.toThrow('WR_PARENT');
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: projectId, tenantId: 'tenant-a' },
      }),
    );
  });

  it('enrols a new Bid Work Request in the current cycle without changing its Bid parent', async () => {
    const create = jest.fn().mockResolvedValue({});
    const repository = new WorkRequestRepository({
      execute: (work: (db: unknown) => Promise<unknown>) => work({
        bid: { findFirst: jest.fn().mockResolvedValue({ statusEvents: [{ toStatus: { code: 'BIDDING' } }], businessCycles: [{ id: 'cycle-a' }] }) },
        workRequestV1: { create, findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'wr-a' }) },
        workRequestV1Event: { create: jest.fn() },
        workRequestV1Document: { createMany: jest.fn() }, workRequestV1DocumentVersion: { createMany: jest.fn() },
      }),
    } as never);
    await RequestContext.run({ requestId: 'request-a', tenantId: 'tenant-a' }, () => repository.create({ id: 'wr-a', bidId, title: 'Request', priority: 'NORMAL' as never, actorId: 'actor-a', files: [] }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ bidId, directProjectId: undefined, bidBusinessCycleId: 'cycle-a' }) }));
  });

  it('leaves Bid cycle membership null for a Project Work Request', async () => {
    const create = jest.fn().mockResolvedValue({});
    const repository = new WorkRequestRepository({
      execute: (work: (db: unknown) => Promise<unknown>) => work({
        workRequestV1: { create, findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'wr-a' }) },
        workRequestV1Event: { create: jest.fn() },
        workRequestV1Document: { createMany: jest.fn() }, workRequestV1DocumentVersion: { createMany: jest.fn() },
      }),
    } as never);
    await RequestContext.run({ requestId: 'request-a', tenantId: 'tenant-a' }, () => repository.create({ id: 'wr-a', projectId, title: 'Request', priority: 'NORMAL' as never, actorId: 'actor-a', files: [] }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ bidId: undefined, directProjectId: projectId, bidBusinessCycleId: null }) }));
  });

  it('rejects a Bid Work Request when no active cycle exists', async () => {
    const repository = new WorkRequestRepository({
      execute: (work: (db: unknown) => Promise<unknown>) => work({ bid: { findFirst: jest.fn().mockResolvedValue({ statusEvents: [{ toStatus: { code: 'BIDDING' } }], businessCycles: [] }) } }),
    } as never);
    await expect(RequestContext.run({ requestId: 'request-a', tenantId: 'tenant-a' }, () => repository.create({ id: 'wr-a', bidId, title: 'Request', priority: 'NORMAL' as never, actorId: 'actor-a', files: [] }))).rejects.toThrow('WR_BID_CYCLE');
  });
});

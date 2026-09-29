import { RequestContext } from '../../common/context/request-context';
import { WorkRequestV1PriorityCode } from '../../generated/prisma/client';
import { WorkRequestService } from '../work-request.service';

type ParentKind = 'bid' | 'project';

describe('Work Request parent lifecycle eligibility', () => {
  const tenantId = 'tenant-a';

  function subject(kind: ParentKind, state: string) {
    const create = jest.fn().mockResolvedValue({
      id: 'work-request-a',
      bidId: kind === 'bid' ? 'bid-a' : null,
      directProjectId: kind === 'project' ? 'project-a' : null,
      title: 'Request',
      priority: WorkRequestV1PriorityCode.High,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdByActor: { id: 'actor-a', label: 'Actor A' },
      events: [],
      documents: [],
      assignments: [],
      infoRequests: [],
    });
    const repository = {
      prepareCreate: jest.fn().mockResolvedValue({
        parent: {
          clientId: 'client-a',
          companyId: 'company-a',
          divisionId: null,
          teamId: null,
          state,
        },
        bidNaming: null,
        codes: new Map<string, string>(),
      }),
      create,
    };
    const service = new WorkRequestService(
      repository as never,
      {} as never,
      {} as never,
      { execute: (work: () => Promise<unknown>) => work() } as never,
      { assertMapping: jest.fn() } as never,
      { assert: jest.fn() } as never,
      {
        putAll: jest.fn().mockResolvedValue([]),
        compensate: jest.fn(),
      },
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, create };
  }

  function createFor(kind: ParentKind, state: string) {
    const { service, create } = subject(kind, state);
    const input = {
      ...(kind === 'bid' ? { bidId: 'bid-a' } : { projectId: 'project-a' }),
      title: 'Request',
      priority: WorkRequestV1PriorityCode.High,
    };
    const operation = RequestContext.run(
      { requestId: 'request-a', tenantId },
      () => service.create(input, [], { id: 'actor-a' } as never),
    );
    return { operation, create };
  }

  it('allows a BIDDING Bid parent', async () => {
    const { operation, create } = createFor('bid', 'BIDDING');
    await expect(operation).resolves.toEqual(
      expect.objectContaining({ id: 'work-request-a' }),
    );
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('rejects a non-BIDDING Bid parent', async () => {
    const { operation, create } = createFor('bid', 'COMPLETED');
    await expect(operation).rejects.toThrow(
      'Parent is not eligible for a Work Request.',
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('allows an ACTIVE direct Project parent', async () => {
    const { operation, create } = createFor('project', 'ACTIVE');
    await expect(operation).resolves.toEqual(
      expect.objectContaining({ id: 'work-request-a' }),
    );
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('rejects a non-ACTIVE direct Project parent', async () => {
    const { operation, create } = createFor('project', 'COMPLETED');
    await expect(operation).rejects.toThrow(
      'Parent is not eligible for a Work Request.',
    );
    expect(create).not.toHaveBeenCalled();
  });
});

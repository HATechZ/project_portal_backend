import { RequestContext } from '../../common/context/request-context';
import {
  ActorRoleCode,
  WorkRequestV1PriorityCode,
} from '../../generated/prisma/client';
import { WorkRequestService } from '../work-request.service';

type ParentKind = 'bid' | 'project';

describe('Work Request parent lifecycle eligibility', () => {
  const tenantId = 'tenant-a';

  function subject(kind: ParentKind, state: string) {
    const create = jest.fn().mockResolvedValue({
      id: 'work-request-a',
      bidId: kind === 'bid' ? 'bid-a' : null,
      directProjectId: kind === 'project' ? 'project-a' : null,
      bid: kind === 'bid' ? { shipmentNumber: '01' } : null,
      directProject: kind === 'project' ? { shipmentNumber: '01' } : null,
      title: 'Request',
      priority: WorkRequestV1PriorityCode.High,
      originatingDivisionId: 'division-a',
      intermediateDivisionIds: ['division-b'],
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
        bidNaming: {},
        codes: new Map([
          ['code-a', { code: '000', name: 'Info' }],
        ]),
      }),
      findCreateReplay: jest.fn().mockResolvedValue(null),
      create,
    };
    const storage = {
      put: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const storageProvider = {
      putAll: jest.fn().mockResolvedValue([]),
      compensate: jest.fn().mockResolvedValue(undefined),
    };
    const service = new WorkRequestService(
      repository as never,
      {} as never,
      {} as never,
      { execute: (work: () => Promise<unknown>) => work() } as never,
      storageProvider as never,
      {} as never,
      {} as never,
      { generatedFileName: jest.fn().mockReturnValue('generated.pdf') } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {},
      {},
      storage,
      undefined,
      undefined,
      { enqueueAll: jest.fn() },
      { assertCanAccess: jest.fn() },
    );
    return { service, create, storage, storageProvider };
  }

  function createFor(kind: ParentKind, state: string) {
    const { service, create } = subject(kind, state);
    const input = {
      ...(kind === 'bid' ? { bidId: 'bid-a' } : { projectId: 'project-a' }),
      title: 'Request',
      priority: WorkRequestV1PriorityCode.High,
      originatingDivisionId: 'division-a',
      intermediateDivisionIds: ['division-b'],
    };
    const operation = RequestContext.run(
      { requestId: 'request-a', tenantId },
      () =>
        service.create(input, [], {
          id: 'actor-a',
          member: { id: 'member-a' },
        } as never),
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

  it('allows tenant_super_admin to create a route with an explicitly selected originating Lead', async () => {
    const { service, create } = subject('bid', 'BIDDING');
    const admin = {
      id: 'admin-a',
      member: null,
      clientContact: null,
      role: {
        customScope: null,
        systemRole: { systemCode: ActorRoleCode.tenant_super_admin },
      },
    } as never;
    await expect(
      RequestContext.run({ requestId: 'request-admin', tenantId }, () =>
        service.create(
          {
            bidId: 'bid-a',
            title: 'Request',
            priority: WorkRequestV1PriorityCode.High,
            originatingDivisionId: 'division-a',
            responsibleOriginatingDivisionLeadId: 'origin-lead-a',
            intermediateDivisionIds: ['division-b'],
          },
          [],
          admin,
        ),
      ),
    ).resolves.toEqual(expect.objectContaining({ id: 'work-request-a' }));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorMemberId: null,
        responsibleOriginatingDivisionLeadId: 'origin-lead-a',
      }),
    );
  });

  it('allows an active business Member to bind the exact originating Lead without administrator identity', async () => {
    const { service, create } = subject('bid', 'BIDDING');
    const businessCreator = {
      id: 'business-actor-a',
      member: {
        id: 'business-member-a',
        isActive: true,
        company: { isActive: true },
      },
      clientContact: null,
      role: { customScope: 'company', systemRole: null },
    } as never;
    await expect(
      RequestContext.run({ requestId: 'request-business', tenantId }, () =>
        service.create(
          {
            bidId: 'bid-a',
            title: 'Request',
            priority: WorkRequestV1PriorityCode.High,
            originatingDivisionId: 'division-a',
            responsibleOriginatingDivisionLeadId: 'origin-lead-a',
            intermediateDivisionIds: ['division-b'],
          },
          [],
          businessCreator,
        ),
      ),
    ).resolves.toEqual(expect.objectContaining({ id: 'work-request-a' }));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorMemberId: 'business-member-a',
        responsibleOriginatingDivisionLeadId: 'origin-lead-a',
      }),
    );
  });

  it('rejects a non-ACTIVE direct Project parent', async () => {
    const { operation, create } = createFor('project', 'COMPLETED');
    await expect(operation).rejects.toThrow(
      'Parent is not eligible for a Work Request.',
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('does not create a Work Request when either required route input is absent', async () => {
    const { service, create } = subject('bid', 'BIDDING');
    const actor = { id: 'actor-a', member: { id: 'member-a' } } as never;
    const input = {
      bidId: 'bid-a',
      title: 'Request',
      priority: WorkRequestV1PriorityCode.High,
    };

    await expect(
      RequestContext.run(
        { requestId: 'request-a', tenantId },
        () => service.create(input, [], actor),
      ),
    ).rejects.toThrow(
      'An originating Division and at least one intermediate Division are required.',
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('does not persist metadata when binary storage fails', async () => {
    const { service, create, storage } = subject('bid', 'BIDDING');
    storage.put.mockRejectedValueOnce(new Error('disk unavailable'));
    await expect(
      RequestContext.run({ requestId: 'storage-failure', tenantId }, () =>
        service.create(
          {
            bidId: 'bid-a',
            title: 'Request',
            priority: WorkRequestV1PriorityCode.High,
            originatingDivisionId: 'division-a',
            intermediateDivisionIds: ['division-b'],
            documentCodeIds: ['code-a'],
          },
          [
            {
              originalname: 'source.pdf',
              mimetype: 'application/pdf',
              size: 3,
              buffer: Buffer.from('pdf'),
            },
          ],
          { id: 'actor-a', member: { id: 'member-a' } } as never,
        ),
      ),
    ).rejects.toThrow('disk unavailable');
    expect(create).not.toHaveBeenCalled();
  });

  it('compensates a written binary when the Work Request transaction fails', async () => {
    const { service, create, storage } = subject('bid', 'BIDDING');
    create.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(
      RequestContext.run({ requestId: 'database-failure', tenantId }, () =>
        service.create(
          {
            bidId: 'bid-a',
            title: 'Request',
            priority: WorkRequestV1PriorityCode.High,
            originatingDivisionId: 'division-a',
            intermediateDivisionIds: ['division-b'],
            documentCodeIds: ['code-a'],
          },
          [
            {
              originalname: 'source.pdf',
              mimetype: 'application/pdf',
              size: 3,
              buffer: Buffer.from('pdf'),
            },
          ],
          { id: 'actor-a', member: { id: 'member-a' } } as never,
        ),
      ),
    ).rejects.toThrow('database unavailable');
    expect(storage.remove).toHaveBeenCalledWith(
      expect.stringMatching(/^tenants\/tenant-a\/work-requests\//),
    );
  });
});

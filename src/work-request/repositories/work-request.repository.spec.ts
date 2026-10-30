import { RequestContext } from '../../common/context/request-context';
import { WorkRequestRepository } from './work-request.repository';

type WorkRequestCreateArgs = {
  data: {
    bidId?: string;
    directProjectId?: string;
    bidBusinessCycleId?: string | null;
  };
};

type WorkRequestEventCreateArgs = {
  data: {
    correlationId: string;
    id: string;
    idempotencyKey: string;
  };
};

interface TypedMock<T> {
  mock: {
    calls: [T][];
  };
}

function firstCallArgument<T>(mock: TypedMock<T>): T {
  const [argument] = mock.mock.calls[0] ?? [];

  if (argument === undefined) {
    throw new Error('Expected mock to have been called.');
  }

  return argument;
}

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
      () => repository.prepareCreate(bid, project, [], 'division-a'),
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
      () => repository.prepareCreate(undefined, projectId, [], 'division-a'),
    );

    await expect(operation).rejects.toThrow('WR_PARENT');
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: projectId, tenantId: 'tenant-a' },
      }),
    );
  });

  it('enrols a new Bid Work Request in the current cycle without changing its Bid parent', async () => {
    const create = jest
      .fn<(argument: WorkRequestCreateArgs) => Promise<unknown>>()
      .mockResolvedValue({});
    const repository = new WorkRequestRepository({
      execute: (work: (db: unknown) => Promise<unknown>) =>
        work({
          bid: {
            findFirst: jest.fn().mockResolvedValue({
              statusEvents: [{ toStatus: { code: 'BIDDING' } }],
              businessCycles: [{ id: 'cycle-a' }],
            }),
          },
          workRequestV1: {
            create,
            findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'wr-a' }),
          },
          workRequestV1Event: { create: jest.fn() },
          workRequestV1Document: { createMany: jest.fn() },
          workRequestV1DocumentVersion: { createMany: jest.fn() },
        }),
    } as never);
    await RequestContext.run(
      { requestId: 'request-a', tenantId: 'tenant-a' },
      () =>
        repository.create({
          id: 'wr-a',
          bidId,
          title: 'Request',
          priority: 'NORMAL' as never,
          actorId: 'actor-a',
          files: [],
        }),
    );
    expect(firstCallArgument(create).data).toMatchObject({
      bidId,
      directProjectId: undefined,
      bidBusinessCycleId: 'cycle-a',
    });
  });

  it('leaves Bid cycle membership null for a Project Work Request', async () => {
    const create = jest
      .fn<(argument: WorkRequestCreateArgs) => Promise<unknown>>()
      .mockResolvedValue({});
    const repository = new WorkRequestRepository({
      execute: (work: (db: unknown) => Promise<unknown>) =>
        work({
          workRequestV1: {
            create,
            findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'wr-a' }),
          },
          workRequestV1Event: { create: jest.fn() },
          workRequestV1Document: { createMany: jest.fn() },
          workRequestV1DocumentVersion: { createMany: jest.fn() },
        }),
    } as never);
    await RequestContext.run(
      { requestId: 'request-a', tenantId: 'tenant-a' },
      () =>
        repository.create({
          id: 'wr-a',
          projectId,
          title: 'Request',
          priority: 'NORMAL' as never,
          actorId: 'actor-a',
          files: [],
        }),
    );
    expect(firstCallArgument(create).data).toMatchObject({
      bidId: undefined,
      directProjectId: projectId,
      bidBusinessCycleId: null,
    });
  });

  it.each([
    ['Bid', bidId, undefined, 'A'],
    ['Direct Project', undefined, projectId, '01'],
  ])(
    'persists %s initial document-version revision semantics',
    async (_, bid, project, revisionCode) => {
      const createMany = jest.fn();
      const documentCreateMany = jest.fn();
      const repository = new WorkRequestRepository({
        execute: (work: (db: unknown) => Promise<unknown>) =>
          work({
            bid: {
              findFirst: jest.fn().mockResolvedValue({
                statusEvents: [{ toStatus: { code: 'BIDDING' } }],
                businessCycles: [{ id: 'cycle-a' }],
              }),
            },
            workRequestV1: {
              create: jest.fn(),
              findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'wr-a' }),
            },
            workRequestV1Event: { create: jest.fn() },
            workRequestV1Document: { createMany: documentCreateMany },
            workRequestV1DocumentVersion: { createMany },
          }),
      } as never);
      await RequestContext.run(
        { requestId: 'request-a', tenantId: 'tenant-a' },
        () =>
          repository.create({
            id: 'wr-a',
            bidId: bid,
            projectId: project,
            title: 'Request',
            priority: 'NORMAL' as never,
            actorId: 'actor-a',
            creationEventId: 'event-a',
            idempotencyKey: 'request-a',
            revisionCode,
            files: [
              {
                id: 'document-a',
                versionId: 'version-a',
                documentCodeId: 'code-a',
                documentCodeSnapshot: 'CODE',
                documentNameSnapshot: 'Document',
                originalFileName: 'source.pdf',
                description: 'Main plan',
                shipmentNumber: 'S-001',
                generatedFileName: `generated-${revisionCode}.pdf`,
                storageKey: 'key-a',
                mimeType: 'application/pdf',
                fileSizeBytes: 1n,
              },
            ],
          }),
      );
      expect(createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [
            expect.objectContaining({
              versionNumber: 1,
              revisionCode,
              generatedFileName: `generated-${revisionCode}.pdf`,
            }),
          ],
        }),
      );
      expect(documentCreateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [
            expect.objectContaining({
              description: 'Main plan',
              shipmentNumber: 'S-001',
            }),
          ],
        }),
      );
    },
  );

  it('uses the create event identity and request idempotency key', async () => {
    const eventCreate = jest
      .fn<(argument: WorkRequestEventCreateArgs) => Promise<unknown>>()
      .mockResolvedValue({});
    const repository = new WorkRequestRepository({
      execute: (work: (db: unknown) => Promise<unknown>) =>
        work({
          workRequestV1: {
            create: jest.fn(),
            findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'wr-a' }),
          },
          workRequestV1Event: { create: eventCreate },
          workRequestV1Document: { createMany: jest.fn() },
          workRequestV1DocumentVersion: { createMany: jest.fn() },
        }),
    } as never);
    await RequestContext.run(
      { requestId: 'request-a', tenantId: 'tenant-a' },
      () =>
        repository.create({
          id: 'wr-a',
          projectId,
          title: 'Request',
          priority: 'NORMAL' as never,
          actorId: 'actor-a',
          creationEventId: 'event-a',
          idempotencyKey: 'request-a',
          revisionCode: '01',
          files: [],
        }),
    );
    expect(firstCallArgument(eventCreate).data).toMatchObject({
      id: 'event-a',
      idempotencyKey: 'request-a',
      correlationId: 'request-a',
    });
  });

  it('persists metadata for a later Work Request document upload', async () => {
    const create = jest.fn();
    const repository = new WorkRequestRepository({
      execute: (work: (db: unknown) => Promise<unknown>) =>
        work({
          workRequestV1: {
            findFirst: jest.fn().mockResolvedValue({ id: 'wr-a' }),
          },
          workRequestV1Document: {
            create,
            findMany: jest.fn().mockResolvedValue([]),
          },
        }),
    } as never);

    await RequestContext.run(
      { requestId: 'request-a', tenantId: 'tenant-a' },
      () =>
        repository.createStandaloneDocuments('wr-a', 'actor-a', [
          {
            documentId: 'document-a',
            versionId: 'version-a',
            documentCodeId: 'code-a',
            documentCode: 'CODE',
            documentName: 'Document',
            originalFileName: 'source.pdf',
            description: 'Later upload',
            shipmentNumber: 'S-002',
            uploadedFileName: 'source.pdf',
            versionNumber: 1,
            revisionCode: 'A',
            generatedFileName: 'generated.pdf',
            storageKey: 'key-a',
            mimeType: 'application/pdf',
            fileSizeBytes: 1n,
            content: Buffer.from('x'),
          },
        ]),
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: 'Later upload',
          shipmentNumber: 'S-002',
        }) as unknown,
      }),
    );
  });

  it('rejects a Bid Work Request when no active cycle exists', async () => {
    const repository = new WorkRequestRepository({
      execute: (work: (db: unknown) => Promise<unknown>) =>
        work({
          bid: {
            findFirst: jest.fn().mockResolvedValue({
              statusEvents: [{ toStatus: { code: 'BIDDING' } }],
              businessCycles: [],
            }),
          },
        }),
    } as never);
    await expect(
      RequestContext.run({ requestId: 'request-a', tenantId: 'tenant-a' }, () =>
        repository.create({
          id: 'wr-a',
          bidId,
          title: 'Request',
          priority: 'NORMAL' as never,
          actorId: 'actor-a',
          files: [],
        }),
      ),
    ).rejects.toThrow('WR_BID_CYCLE');
  });
});

describe('WorkRequestRepository document-code applicability', () => {
  const documentCode = {
    id: 'code-a',
    code: 'ENG-01',
    name: 'Engineering drawing',
    documentGroup: 'ENGINEERING',
  };

  function repositoryForDocumentCodes(groups: { documentGroup: string }[]) {
    const groupsLookup = jest.fn().mockResolvedValue(groups);
    const codeLookup = jest.fn().mockResolvedValue([documentCode]);
    return new WorkRequestRepository({
      execute: (work: (db: unknown) => Promise<unknown>) =>
        work({
          workRequestV1: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'work-request-a',
              bid: {
                clientId: 'client-a',
                client: { companyId: 'company-a' },
                biddingNumber: 'BID-1',
                projectCode: 'PROJECT',
                cargoCodeSnapshot: 'CARGO',
                vesselCodeSnapshot: 'VESSEL',
                shipmentNumber: '01',
              },
              directProject: null,
              route: {
                originatingDivisionId: 'origin-a',
                projection: { routeStep: { divisionId: 'execution-a' } },
              },
              assignments: [],
            }),
          },
          divisionDocumentGroup: { findMany: groupsLookup },
          documentCodeOption: { findMany: codeLookup },
        }),
    } as never);
  }

  it('uses the current execution Division mapping, not an actor identity, for selector groups', async () => {
    const repository = repositoryForDocumentCodes([
      { documentGroup: 'ENGINEERING' },
      { documentGroup: 'PROJECT_MANAGEMENT_OPERATION' },
    ]);
    const result = await RequestContext.run(
      { requestId: 'request-a', tenantId: 'tenant-a' },
      () => repository.availableDocumentCodes('work-request-a'),
    );
    expect(result?.divisionId).toBe('execution-a');
    expect(result?.codes).toEqual([documentCode]);
  });

  it('always includes GENERAL and rejects an active code outside the current Division groups', async () => {
    const codeLookup = jest.fn().mockResolvedValue([]);
    const repository = new WorkRequestRepository({
      execute: (work: (db: unknown) => Promise<unknown>) =>
        work({
          workRequestV1: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'work-request-a',
              bid: {
                clientId: 'client-a',
                client: { companyId: 'company-a' },
                biddingNumber: 'BID-1',
                projectCode: 'PROJECT',
                cargoCodeSnapshot: 'CARGO',
                vesselCodeSnapshot: 'VESSEL',
                shipmentNumber: '01',
              },
              directProject: null,
              route: {
                projection: { routeStep: { divisionId: 'engineering-a' } },
              },
              assignments: [],
            }),
          },
          divisionDocumentGroup: {
            findMany: jest
              .fn()
              .mockResolvedValue([{ documentGroup: 'ENGINEERING' }]),
          },
          documentCodeOption: { findMany: codeLookup },
        }),
    } as never);
    await expect(
      RequestContext.run({ requestId: 'request-a', tenantId: 'tenant-a' }, () =>
        repository.prepareStandaloneDocuments('work-request-a', [
          'marketing-code',
        ]),
      ),
    ).rejects.toThrow('WR_DOCUMENT_CODE');
    expect(codeLookup).toHaveBeenCalledTimes(1);
  });
});

import { RequestContext } from '../../common/context/request-context';
import { ProjectRepository } from './project.repository';

const tenantId = 'tenant-a';

describe('ProjectRepository lifecycle foundation', () => {
  it('persists the initial ACTIVE event with the direct Project in the tenant transaction', async () => {
    let directProjectCreateInput: { data: { tenantId: string } } | undefined;
    let statusEventInput:
      | {
          data: {
            tenantId: string;
            directProjectId: string;
            toStatusId: string;
            changedByActorId: string;
          };
        }
      | undefined;
    const directProjectCreate = (input: { data: { tenantId: string } }) => {
      directProjectCreateInput = input;
      return Promise.resolve({});
    };
    const statusEventCreate = (input: {
      data: {
        tenantId: string;
        directProjectId: string;
        toStatusId: string;
        changedByActorId: string;
      };
    }) => {
      statusEventInput = input;
      return Promise.resolve({});
    };
    const repository = new ProjectRepository({
      execute: (work: (db: unknown) => Promise<unknown>) =>
        work({
          client: {
            findFirst: jest.fn().mockResolvedValue({ id: 'client-a' }),
          },
          optionValue: {
            findMany: jest.fn().mockResolvedValue([
              {
                id: 'pol-a',
                name: 'Korea',
                code: 'KOR',
                optionType: { code: 'POL' },
              },
              {
                id: 'pod-a',
                name: 'Mexico',
                code: 'MEX',
                optionType: { code: 'POD' },
              },
              {
                id: 'cargo-a',
                name: 'Cargo',
                code: 'CRA',
                optionType: { code: 'CARGO_CODE' },
              },
              {
                id: 'vessel-a',
                name: 'Vessel',
                code: 'CA2',
                optionType: { code: 'VESSEL_CODE' },
              },
            ]),
          },
          documentCodeOption: { findMany: jest.fn().mockResolvedValue([]) },
          directProjectStatus: {
            findUniqueOrThrow: jest
              .fn()
              .mockResolvedValue({ id: 'active-status' }),
          },
          directProject: {
            create: directProjectCreate,
            findFirstOrThrow: jest.fn().mockResolvedValue({}),
          },
          businessNameClaim: { create: jest.fn().mockResolvedValue({}) },
          directProjectStatusEvent: { create: statusEventCreate },
        }),
    } as never);

    await RequestContext.run({ requestId: 'request-a', tenantId }, () =>
      repository.create({
        id: 'project-a',
        clientId: 'client-a',
        polId: 'pol-a',
        podId: 'pod-a',
        cargoId: 'cargo-a',
        vesselId: 'vessel-a',
        projectCode: 'MKM',
        shipmentNumber: '01',
        name: 'Meridian Project',
        normalizedName: 'meridian project',
        actorId: 'actor-a',
        files: [],
        snapshots: {
          polName: 'Korea',
          podName: 'Mexico',
          cargoCode: 'CRA',
          vesselCode: 'CA2',
        },
      }),
    );

    expect(directProjectCreateInput).toMatchObject({
      data: { tenantId, shipmentNumber: '01' },
    });
    expect(statusEventInput).toMatchObject({
      data: {
        tenantId,
        directProjectId: 'project-a',
        toStatusId: 'active-status',
        changedByActorId: 'actor-a',
      },
    });
  });

  it('uses a tenant-qualified latest-event query so direct Project status history is reconstructable', async () => {
    let findInput: unknown;
    const findFirst = (input: unknown) => {
      findInput = input;
      return Promise.resolve(null);
    };
    const repository = new ProjectRepository({
      execute: (work: (db: unknown) => Promise<unknown>) =>
        work({ directProject: { findFirst } }),
    } as never);

    await RequestContext.run({ requestId: 'request-a', tenantId }, () =>
      repository.find('project-a'),
    );

    expect(findInput).toMatchObject({
      where: { id: 'project-a', tenantId },
      select: {
        statusEvents: {
          take: 1,
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        },
      },
    });
  });

  it('rejects a missing tenant-scoped POL/POD/Cargo/Vessel reference', async () => {
    const repository = new ProjectRepository({
      execute: (work: (db: unknown) => Promise<unknown>) =>
        work({
          client: {
            findFirst: jest.fn().mockResolvedValue({ id: 'client-a' }),
          },
          optionValue: { findMany: jest.fn().mockResolvedValue([]) },
          documentCodeOption: { findMany: jest.fn().mockResolvedValue([]) },
        }),
    } as never);
    await expect(
      RequestContext.run({ requestId: 'request-a', tenantId }, () =>
        repository.prepareCreate({
          clientId: 'client-a',
          polId: 'pol-a',
          podId: 'pod-a',
          cargoId: 'cargo-a',
          vesselId: 'vessel-a',
          documentCodeIds: [],
        }),
      ),
    ).rejects.toThrow('PROJECT_REFERENCE_OPTION');
  });
});

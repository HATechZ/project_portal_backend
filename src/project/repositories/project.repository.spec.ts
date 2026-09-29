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
        name: 'Meridian Project',
        normalizedName: 'meridian project',
        actorId: 'actor-a',
        files: [],
      }),
    );

    expect(directProjectCreateInput).toMatchObject({ data: { tenantId } });
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
});

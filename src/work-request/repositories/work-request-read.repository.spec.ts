import { RequestContext } from '../../common/context/request-context';
import { Prisma } from '../../generated/prisma/client';
import { WorkRequestReadRepository } from './work-request-read.repository';

describe('WorkRequestReadRepository', () => {
  it('lists every Work Request in the active tenant for a tenant-wide scope', async () => {
    const findMany = jest
      .fn<Promise<unknown[]>, [Prisma.WorkRequestV1FindManyArgs]>()
      .mockResolvedValue([]);
    const uow = {
      execute: (work: (db: unknown) => Promise<unknown>) =>
        work({ workRequestV1: { findMany } }),
    };
    const repository = new WorkRequestReadRepository(uow as never);
    const tenantId = '00000000-0000-4000-8000-000000000001';

    await RequestContext.run({ tenantId } as never, () =>
      repository.list(0, 20, { tenantWide: true }),
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId },
        skip: 0,
        take: 20,
      }),
    );
  });

  it('lists a TEAM-scoped custom actor only against its exact active Team assignment', async () => {
    let receivedArgs: Prisma.WorkRequestV1FindManyArgs | undefined;
    const findMany = jest
      .fn<Promise<unknown[]>, [Prisma.WorkRequestV1FindManyArgs]>()
      .mockImplementation((args) => {
        receivedArgs = args;
        return Promise.resolve([]);
      });
    const repository = new WorkRequestReadRepository({
      execute: (work: (db: unknown) => Promise<unknown>) =>
        work({ workRequestV1: { findMany } }),
    } as never);

    await RequestContext.run({ tenantId: 'tenant-a' } as never, () =>
      repository.list(0, 20, { teamId: 'team-a' }),
    );

    expect(receivedArgs?.where).toEqual({
      tenantId: 'tenant-a',
      assignments: {
        some: {
          level: 'TEAM',
          teamId: 'team-a',
          unassignedAt: null,
          replacedAt: null,
        },
      },
    });
  });

  it('lists a DIVISION-scoped custom actor only against its active Division assignment', async () => {
    let receivedArgs: Prisma.WorkRequestV1FindManyArgs | undefined;
    const findMany = jest
      .fn<Promise<unknown[]>, [Prisma.WorkRequestV1FindManyArgs]>()
      .mockImplementation((args) => {
        receivedArgs = args;
        return Promise.resolve([]);
      });
    const repository = new WorkRequestReadRepository({
      execute: (work: (db: unknown) => Promise<unknown>) =>
        work({ workRequestV1: { findMany } }),
    } as never);

    await RequestContext.run({ tenantId: 'tenant-a' } as never, () =>
      repository.list(0, 20, { divisionId: 'division-a' }),
    );

    expect(receivedArgs?.where).toEqual({
      tenantId: 'tenant-a',
      assignments: {
        some: {
          level: 'DIVISION',
          divisionId: 'division-a',
          unassignedAt: null,
          replacedAt: null,
        },
      },
    });
  });
});

import { RequestContext } from '../../common/context/request-context';
import { Prisma } from '../../generated/prisma/client';
import { WorkRequestReadRepository } from './work-request-read.repository';

describe('WorkRequestReadRepository', () => {
  const companyActor = {
    role: { customScope: 'company', systemRole: null },
    member: null,
  } as never;
  it('lists every Work Request in the active tenant without role-derived filtering', async () => {
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
      repository.list(0, 20, companyActor),
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId },
        skip: 0,
        take: 20,
      }),
    );
  });

  it('uses explicit company object scope without a role-name fallback', async () => {
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
      repository.list(0, 20, companyActor),
    );

    expect(receivedArgs?.where).toEqual({ tenantId: 'tenant-a' });
  });

  it('keeps tenant isolation for an explicitly scoped actor', async () => {
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
      repository.list(0, 20, companyActor),
    );

    expect(receivedArgs?.where).toEqual({ tenantId: 'tenant-a' });
  });
});

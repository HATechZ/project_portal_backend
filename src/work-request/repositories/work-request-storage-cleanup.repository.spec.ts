import { RequestContext } from '../../common/context/request-context';
import { WorkRequestStorageCleanupRepository } from './work-request-storage-cleanup.repository';

describe('WorkRequestStorageCleanupRepository', () => {
  const tenantId = '00000000-0000-4000-8000-000000000001';

  function subject() {
    const upsert = jest.fn().mockResolvedValue(undefined);
    const uow = {
      execute: (work: (db: unknown) => Promise<unknown>) =>
        work({ workRequestStorageCleanupJob: { upsert } }),
    };
    return {
      repository: new WorkRequestStorageCleanupRepository(uow as never),
      upsert,
    };
  }

  it('upserts a cleanup job in the request tenant', async () => {
    const { repository, upsert } = subject();

    await RequestContext.run({ tenantId } as never, () =>
      repository.enqueue('tenant/work-requests/orphan', new Error('locked')),
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_storageKey: {
            tenantId,
            storageKey: 'tenant/work-requests/orphan',
          },
        },
        create: expect.objectContaining({
          tenantId,
          storageKey: 'tenant/work-requests/orphan',
          attempts: 1,
        }),
      }),
    );
  });

  it('uses the same tenant/storage key conflict target for duplicate cleanup requests', async () => {
    const { repository, upsert } = subject();

    await RequestContext.run({ tenantId } as never, async () => {
      await repository.enqueue(
        'tenant/work-requests/orphan',
        new Error('first'),
      );
      await repository.enqueue(
        'tenant/work-requests/orphan',
        new Error('second'),
      );
    });

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        where: {
          tenantId_storageKey: {
            tenantId,
            storageKey: 'tenant/work-requests/orphan',
          },
        },
        update: expect.objectContaining({
          attempts: { increment: 1 },
          lastError: 'second',
        }),
      }),
    );
  });

  it('keeps identical storage keys isolated by tenant', async () => {
    const { repository, upsert } = subject();
    const otherTenantId = '00000000-0000-4000-8000-000000000002';

    await RequestContext.run({ tenantId } as never, () =>
      repository.enqueue('shared/work-requests/orphan', new Error('first')),
    );
    await RequestContext.run({ tenantId: otherTenantId } as never, () =>
      repository.enqueue('shared/work-requests/orphan', new Error('second')),
    );

    expect(upsert.mock.calls[0][0].where).toEqual({
      tenantId_storageKey: {
        tenantId,
        storageKey: 'shared/work-requests/orphan',
      },
    });
    expect(upsert.mock.calls[1][0].where).toEqual({
      tenantId_storageKey: {
        tenantId: otherTenantId,
        storageKey: 'shared/work-requests/orphan',
      },
    });
  });
});

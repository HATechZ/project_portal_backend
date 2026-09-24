import { RequestContext } from '../../common/context/request-context';
import { WorkRequestReadRepository } from './work-request-read.repository';

describe('WorkRequestReadRepository', () => {
  it('lists every Work Request in the active tenant for a tenant-wide scope', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
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
});

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
});

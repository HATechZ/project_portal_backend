import { RequestContext } from '../../common/context/request-context';
import { WorkRequestAssignmentReadRepository } from './work-request-assignment-read.repository';

describe('WorkRequestAssignmentReadRepository', () => {
  it('selects only the safe target Member display fields for assignment history', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const repository = new WorkRequestAssignmentReadRepository({
      execute: (work: (db: unknown) => Promise<unknown>) =>
        work({ workRequestV1Assignment: { findMany } }),
    } as never);

    await RequestContext.run({ tenantId: 'tenant-a' } as never, () =>
      repository.history('request-a'),
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-a', workRequestId: 'request-a' },
        select: expect.objectContaining({
          member: { select: { id: true, name: true } },
          assignedByActor: { select: { id: true, label: true } },
        }),
      }),
    );
  });
});

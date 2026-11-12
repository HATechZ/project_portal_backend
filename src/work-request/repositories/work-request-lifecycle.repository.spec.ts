import { RequestContext } from '../../common/context/request-context';
import { WorkRequestLifecycleRepository } from './work-request-lifecycle.repository';

describe('WorkRequestLifecycleRepository', () => {
  function subject(archivedAt: Date | null) {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'request-a',
      archivedAt,
      archivedByActorId: archivedAt ? 'actor-old' : null,
      archiveReason: archivedAt ? 'old reason' : null,
      events: [{ resultingState: 'MEMBER_ASSIGNED' }],
    });
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const create = jest.fn().mockResolvedValue({
      id: 'event-a',
      action: archivedAt ? 'WORK_REQUEST_RESTORED' : 'WORK_REQUEST_ARCHIVED',
      occurredAt: new Date('2026-11-12T00:00:00.000Z'),
    });
    const repository = new WorkRequestLifecycleRepository({
      execute: (work: (db: unknown) => Promise<unknown>) =>
        work({
          workRequestV1: { findFirst, updateMany },
          workRequestV1Event: { create },
        }),
    } as never);
    return { repository, updateMany, create };
  }

  it('persists archive metadata and one state-preserving audit event', async () => {
    const { repository, updateMany, create } = subject(null);
    await RequestContext.run(
      { tenantId: 'tenant-a', requestId: 'request-id' },
      () =>
        repository.archive(
          'request-a',
          'actor-a',
          'No longer needed',
          'request-id',
        ),
    );

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'request-a', tenantId: 'tenant-a', archivedAt: null },
        data: expect.objectContaining({
          archivedByActorId: 'actor-a',
          archiveReason: 'No longer needed',
        }),
      }),
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'WORK_REQUEST_ARCHIVED',
          priorState: 'MEMBER_ASSIGNED',
          resultingState: 'MEMBER_ASSIGNED',
          note: 'No longer needed',
        }),
      }),
    );
  });

  it('clears only archive lifecycle metadata and appends one restore event', async () => {
    const { repository, updateMany, create } = subject(new Date());
    await RequestContext.run(
      { tenantId: 'tenant-a', requestId: 'request-id' },
      () => repository.restore('request-a', 'actor-a', 'request-id'),
    );

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'request-a',
          tenantId: 'tenant-a',
          archivedAt: { not: null },
        },
        data: {
          archivedAt: null,
          archivedByActorId: null,
          archiveReason: null,
        },
      }),
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'WORK_REQUEST_RESTORED',
          priorState: 'MEMBER_ASSIGNED',
          resultingState: 'MEMBER_ASSIGNED',
        }),
      }),
    );
  });
});

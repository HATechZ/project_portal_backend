import { RequestContext } from '../../common/context/request-context';
import { WorkRequestLifecycleProvider } from './work-request-lifecycle.provider';

describe('WorkRequestLifecycleProvider', () => {
  const actor = { id: 'actor-a' } as never;
  const event = {
    id: 'event-a',
    action: 'WORK_REQUEST_ARCHIVED',
    occurredAt: new Date('2026-11-12T00:00:00.000Z'),
  };

  function subject(result: unknown) {
    const lifecycle = {
      isArchived: jest.fn().mockResolvedValue(false),
      archive: jest.fn().mockResolvedValue(result),
      restore: jest.fn().mockResolvedValue(result),
    };
    const reads = { find: jest.fn().mockResolvedValue({ id: 'request-a' }) };
    const outbox = { enqueue: jest.fn().mockResolvedValue(undefined) };
    const provider = new WorkRequestLifecycleProvider(
      lifecycle as never,
      reads as never,
      { execute: (work: () => Promise<unknown>) => work() } as never,
      outbox as never,
    );
    return { provider, lifecycle, reads, outbox };
  }

  it('archives once with the optional reason and appends the archive event', async () => {
    const { provider, lifecycle, outbox } = subject({
      kind: 'ok',
      id: 'request-a',
      archivedAt: new Date('2026-11-12T00:00:00.000Z'),
      archivedByActorId: 'actor-a',
      archiveReason: 'No longer needed',
      event,
    });

    const response = await RequestContext.run(
      { tenantId: 'tenant-a', requestId: 'request-a' },
      () => provider.archive('request-a', 'No longer needed', actor),
    );

    expect(response.lifecycle).toEqual({
      status: 'archived',
      archivedAt: event.occurredAt,
      archivedByActorId: 'actor-a',
      reason: 'No longer needed',
    });
    expect(lifecycle.archive).toHaveBeenCalledWith(
      'request-a',
      'actor-a',
      'No longer needed',
      'request-a',
    );
    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
  });

  it('restores without recreating data and emits the restore event once', async () => {
    const { provider, lifecycle, outbox } = subject({
      kind: 'ok',
      id: 'request-a',
      archivedAt: null,
      archivedByActorId: null,
      archiveReason: null,
      event: { ...event, action: 'WORK_REQUEST_RESTORED' },
    });

    const response = await RequestContext.run(
      { tenantId: 'tenant-a', requestId: 'request-a' },
      () => provider.restore('request-a', actor),
    );

    expect(response.lifecycle.status).toBe('active');
    expect(lifecycle.restore).toHaveBeenCalledTimes(1);
    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
  });

  it('rejects repeated lifecycle transitions without an extra event', async () => {
    const { provider, outbox } = subject({ kind: 'conflict' });
    await expect(
      RequestContext.run({ tenantId: 'tenant-a' }, () =>
        provider.archive('request-a', undefined, actor),
      ),
    ).rejects.toThrow('already archived');
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('does not reveal inaccessible Work Requests through archive', async () => {
    const { provider, lifecycle, reads } = subject({ kind: 'ok' });
    reads.find.mockResolvedValue(null);
    await expect(
      RequestContext.run({ tenantId: 'tenant-a' }, () =>
        provider.archive('request-a', undefined, actor),
      ),
    ).rejects.toThrow('not found');
    expect(lifecycle.archive).not.toHaveBeenCalled();
  });
});

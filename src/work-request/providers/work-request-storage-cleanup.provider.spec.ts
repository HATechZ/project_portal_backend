import { WorkRequestStorageProvider } from './work-request-storage.provider';

describe('WorkRequestStorageProvider durable compensation', () => {
  it('does not enqueue a cleanup job when immediate deletion succeeds', async () => {
    const cleanup = { enqueue: jest.fn() };
    const storage = { remove: jest.fn().mockResolvedValue(undefined) };
    const provider = new WorkRequestStorageProvider(cleanup as never);

    await provider.compensate(storage as never, [
      'tenant/work-requests/orphan',
    ]);

    expect(cleanup.enqueue).not.toHaveBeenCalled();
  });

  it('enqueues a durable cleanup job when immediate deletion fails', async () => {
    const cleanup = { enqueue: jest.fn().mockResolvedValue(undefined) };
    const storage = {
      remove: jest.fn().mockRejectedValue(new Error('locked')),
    };
    const provider = new WorkRequestStorageProvider(cleanup as never);

    await provider.compensate(storage as never, [
      'tenant/work-requests/orphan',
    ]);

    expect(cleanup.enqueue).toHaveBeenCalledWith(
      'tenant/work-requests/orphan',
      expect.objectContaining({ message: 'locked' }),
    );
  });
});

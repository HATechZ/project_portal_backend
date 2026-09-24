import { WorkRequestStorageCleanupProcessor } from './work-request-storage-cleanup.processor';

describe('WorkRequestStorageCleanupProcessor', () => {
  const job = {
    id: '00000000-0000-4000-8000-000000000001',
    storageKey: 'tenant/work-requests/orphan',
  };

  function subject() {
    const cleanupJobs = {
      findMany: jest.fn().mockResolvedValue([job]),
      delete: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const prisma = { unscoped: { workRequestStorageCleanupJob: cleanupJobs } };
    const storage = { remove: jest.fn().mockResolvedValue(undefined) };
    return {
      processor: new WorkRequestStorageCleanupProcessor(
        prisma as never,
        storage as never,
      ),
      cleanupJobs,
      storage,
    };
  }

  it('removes the orphan and deletes its durable retry record', async () => {
    const { processor, cleanupJobs, storage } = subject();

    await expect(processor.retry()).resolves.toEqual({
      resolved: 1,
      failed: 0,
    });

    expect(cleanupJobs.findMany).toHaveBeenCalledWith({
      take: 100,
      orderBy: { lastAttemptedAt: 'asc' },
    });
    expect(storage.remove).toHaveBeenCalledWith(job.storageKey);
    expect(cleanupJobs.delete).toHaveBeenCalledWith({ where: { id: job.id } });
    expect(cleanupJobs.update).not.toHaveBeenCalled();
  });

  it('increments retry metadata when durable cleanup fails', async () => {
    const { processor, cleanupJobs, storage } = subject();
    storage.remove.mockRejectedValue(new Error('still locked'));

    await expect(processor.retry()).resolves.toEqual({
      resolved: 0,
      failed: 1,
    });

    expect(cleanupJobs.delete).not.toHaveBeenCalled();
    expect(cleanupJobs.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: job.id },
        data: expect.objectContaining({
          attempts: { increment: 1 },
          lastError: 'still locked',
          lastAttemptedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('uses the relay-only unscoped persistence path for retry work', async () => {
    const { processor, cleanupJobs } = subject();

    await processor.retry();

    expect(cleanupJobs.findMany).toHaveBeenCalled();
  });
});

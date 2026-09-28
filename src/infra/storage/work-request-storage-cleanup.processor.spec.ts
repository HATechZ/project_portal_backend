import {
  Prisma,
  WorkRequestStorageCleanupJob,
} from '../../generated/prisma/client';
import { WorkRequestStorageCleanupProcessor } from './work-request-storage-cleanup.processor';

describe('WorkRequestStorageCleanupProcessor', () => {
  const job: WorkRequestStorageCleanupJob = {
    tenantId: '00000000-0000-4000-8000-000000000001',
    id: '00000000-0000-4000-8000-000000000001',
    storageKey: 'tenant/work-requests/orphan',
    attempts: 1,
    lastError: 'locked',
    lastAttemptedAt: new Date(),
    createdAt: new Date(),
  };

  function subject() {
    const cleanupJobs = {
      findMany: jest
        .fn<
          Promise<WorkRequestStorageCleanupJob[]>,
          [Prisma.WorkRequestStorageCleanupJobFindManyArgs]
        >()
        .mockResolvedValue([job]),
      delete: jest
        .fn<
          Promise<WorkRequestStorageCleanupJob>,
          [Prisma.WorkRequestStorageCleanupJobDeleteArgs]
        >()
        .mockResolvedValue(job),
      update: jest
        .fn<
          Promise<WorkRequestStorageCleanupJob>,
          [Prisma.WorkRequestStorageCleanupJobUpdateArgs]
        >()
        .mockResolvedValue(job),
    };
    const prisma = { unscoped: { workRequestStorageCleanupJob: cleanupJobs } };
    const storage = {
      remove: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
    };
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
    const update = cleanupJobs.update.mock.calls[0]?.[0];
    expect(update?.where).toEqual({ id: job.id });
    expect(update?.data).toMatchObject({
      attempts: { increment: 1 },
      lastError: 'still locked',
    });
    expect(update?.data).toHaveProperty('lastAttemptedAt');
  });

  it('uses the relay-only unscoped persistence path for retry work', async () => {
    const { processor, cleanupJobs } = subject();

    await processor.retry();

    expect(cleanupJobs.findMany).toHaveBeenCalled();
  });
});

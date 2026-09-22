/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import { ProjectStorageCleanupProcessor } from './project-storage-cleanup.processor';

describe('ProjectStorageCleanupProcessor', () => {
  const job = {
    id: 'job-1',
    storageKey: 'tenants/t/projects/p/documents/f.pdf',
  };
  it('deletes a completed cleanup job after an idempotent storage remove', async () => {
    const prisma: any = {
      unscoped: {
        directProjectStorageCleanupJob: {
          findMany: jest.fn().mockResolvedValue([job]),
          delete: jest.fn(),
          update: jest.fn(),
        },
      },
    };
    const storage = { remove: jest.fn().mockResolvedValue(undefined) };
    const result = await new ProjectStorageCleanupProcessor(
      prisma,
      storage,
    ).retry();
    expect(result).toEqual({ resolved: 1, failed: 0 });
    expect(storage.remove).toHaveBeenCalledWith(job.storageKey);
    expect(
      prisma.unscoped.directProjectStorageCleanupJob.delete,
    ).toHaveBeenCalledWith({ where: { id: job.id } });
  });
  it('retains a failed cleanup job for an idempotent later retry', async () => {
    const prisma: any = {
      unscoped: {
        directProjectStorageCleanupJob: {
          findMany: jest.fn().mockResolvedValue([job]),
          delete: jest.fn(),
          update: jest.fn(),
        },
      },
    };
    const storage = {
      remove: jest.fn().mockRejectedValue(new Error('locked')),
    };
    const result = await new ProjectStorageCleanupProcessor(
      prisma,
      storage,
    ).retry();
    expect(result).toEqual({ resolved: 0, failed: 1 });
    expect(
      prisma.unscoped.directProjectStorageCleanupJob.update,
    ).toHaveBeenCalledWith(expect.objectContaining({ where: { id: job.id } }));
  });
});

import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  FILE_STORAGE,
  type FileStorage,
} from '../../contracts/storage/file-storage.port';
import { PrismaService } from '../prisma/prisma.service';

/** Idempotently removes orphaned Bid files recorded after failed compensation. */
@Injectable()
export class BidStorageCleanupProcessor {
  private readonly logger = new Logger(BidStorageCleanupProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  async retry(limit = 100): Promise<{ resolved: number; failed: number }> {
    const jobs = await this.prisma.unscoped.bidStorageCleanupJob.findMany({
      take: limit,
      orderBy: { lastAttemptedAt: 'asc' },
    });
    let resolved = 0;
    let failed = 0;
    for (const job of jobs) {
      try {
        await this.storage.remove(job.storageKey);
        await this.prisma.unscoped.bidStorageCleanupJob.delete({
          where: { id: job.id },
        });
        resolved += 1;
      } catch (error) {
        failed += 1;
        await this.prisma.unscoped.bidStorageCleanupJob.update({
          where: { id: job.id },
          data: {
            attempts: { increment: 1 },
            lastError: error instanceof Error ? error.message : String(error),
            lastAttemptedAt: new Date(),
          },
        });
        this.logger.warn(`Bid orphan cleanup retry failed for ${job.id}`);
      }
    }
    return { resolved, failed };
  }
}

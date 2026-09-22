import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';

/** Persists idempotent local-storage compensation work for Project files. */
@Injectable()
export class ProjectStorageCleanupRepository extends BaseRepository {
  constructor(uow: UnitOfWorkService) {
    super(uow);
  }
  enqueue(storageKey: string, error: Error): Promise<void> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      await db.directProjectStorageCleanupJob.upsert({
        where: { tenantId_storageKey: { tenantId, storageKey } },
        create: {
          id: randomUUID(),
          tenantId,
          storageKey,
          attempts: 1,
          lastError: error.message,
          lastAttemptedAt: new Date(),
        },
        update: {
          attempts: { increment: 1 },
          lastError: error.message,
          lastAttemptedAt: new Date(),
        },
      });
    });
  }
}

import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';

/** Persists idempotent Work Request orphan cleanup after immediate removal fails. */
@Injectable()
export class WorkRequestStorageCleanupRepository extends BaseRepository {
  constructor(uow: UnitOfWorkService) {
    super(uow);
  }
  async enqueue(storageKey: string, error: Error): Promise<void> {
    const tenantId = RequestContext.requireTenantId();
    await this.transaction((db) =>
      db.workRequestStorageCleanupJob.upsert({
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
      }),
    );
  }
}

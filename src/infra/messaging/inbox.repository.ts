import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client';
import { BaseRepository } from '../prisma/base.repository';
import { UnitOfWorkService } from '../prisma/unit-of-work.service';

/**
 * Idempotent delivery, enforced by a unique constraint rather than a read.
 *
 * `@@unique([tenantId, eventId, consumer])` *is* the mechanism: two concurrent
 * deliveries both insert, one loses, and the loser skips. A check-then-insert
 * would race between the check and the insert.
 *
 * The `P2002` catch below is the one sanctioned exception to Art. VI.4. It is
 * control flow, not a failure — a duplicate here means "already handled", which
 * is a normal outcome under at-least-once delivery — and it is confined to this
 * file so no domain code learns the trick.
 */
@Injectable()
export class InboxRepository extends BaseRepository {
  constructor(unitOfWork: UnitOfWorkService) {
    super(unitOfWork);
  }

  /**
   * @returns true when this consumer may proceed, false when the event was
   * already processed and must be skipped.
   */
  async claim(eventId: string, consumer: string): Promise<boolean> {
    try {
      await this.db.processedEvent.create({
        // `tenantId` comes from the extension, restored by `EventHandlerBase`
        // before this runs. See `OutboxRepository` for why the cast is needed.
        data: {
          id: randomUUID(),
          eventId,
          consumer,
        } as Prisma.ProcessedEventUncheckedCreateInput,
      });
      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return false;
      }
      throw error;
    }
  }
}

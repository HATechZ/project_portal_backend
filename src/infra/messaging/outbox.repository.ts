import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { DomainEventEnvelope } from '../../contracts/events/domain-event';
import { BaseRepository } from '../prisma/base.repository';
import { UnitOfWorkService } from '../prisma/unit-of-work.service';

/**
 * The outbox write, and the reason the whole pattern works.
 *
 * It extends `BaseRepository` so `this.db` resolves to the ambient transaction:
 * the event row lands in the *producer's* transaction, and a rollback takes the
 * event with it. Injecting the raw client here instead would open a second
 * connection outside that transaction — the dual write this exists to prevent.
 */
@Injectable()
export class OutboxRepository extends BaseRepository {
  constructor(unitOfWork: UnitOfWorkService) {
    super(unitOfWork);
  }

  async enqueue(event: DomainEventEnvelope): Promise<void> {
    await this.transaction((db) =>
      db.outboxMessage.create({
        // `tenantId` is absent on purpose: the tenant extension injects it at
        // query time from `RequestContext`, so a producer cannot name another
        // tenant even by accident. TypeScript cannot see that, hence the cast —
        // the same trade `AuthSessionRepository` makes.
        data: {
          // The event id is the row id. One identity end to end, so a consumer
          // dedupes on the same value the producer minted.
          id: event.eventId,
          eventType: event.eventType,
          routingKey: event.routingKey,
          payload: event.payload as Prisma.InputJsonObject,
          actorId: event.actorId ?? null,
          correlationId: event.correlationId ?? null,
          occurredAt: new Date(event.occurredAt),
        } as Prisma.OutboxMessageUncheckedCreateInput,
      }),
    );
  }
}

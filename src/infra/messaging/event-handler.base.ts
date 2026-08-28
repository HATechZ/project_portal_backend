import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { IEventHandler } from '@nestjs/cqrs';
import { DomainEvent } from '../../contracts/events/domain-event';
import { RequestContext } from '../../common/context/request-context';
import { UnitOfWorkService } from '../prisma/unit-of-work.service';
import { InboxRepository } from './inbox.repository';

/**
 * What every consumer extends. It exists for one reason that is easy to miss.
 *
 * A handler runs on a relay tick, not on an HTTP request, so there is no
 * `AsyncLocalStorage` frame and `RequestContext.requireTenantId()` is empty.
 * The tenant Prisma extension would then throw — or worse, if the model were
 * ever unscoped, read every tenant's rows. The context has to be rebuilt from
 * the event before the handler is allowed anywhere near persistence.
 *
 * The claim and the side effect share one transaction, so a handler that throws
 * rolls back its own dedupe row and the redelivery is clean. Claiming
 * separately would mark an event processed for work that never happened — the
 * outbox bug, mirrored.
 */
export abstract class EventHandlerBase<
  TEvent extends DomainEvent,
> implements IEventHandler<TEvent> {
  protected readonly logger = new Logger(this.constructor.name);

  /** Stable, logical name. Changing it replays every past event. */
  protected abstract readonly consumer: string;

  constructor(
    private readonly inbox: InboxRepository,
    private readonly unitOfWork: UnitOfWorkService,
  ) {}

  async handle(event: TEvent): Promise<void> {
    if (!event.tenantId) {
      // Refuse rather than guess. A tenant-less event cannot be queried for
      // safely, and inventing a default would cross the boundary silently.
      throw new Error(
        `${this.consumer} received ${event.eventType} (${event.eventId}) with no tenant`,
      );
    }

    await RequestContext.run(
      {
        requestId: event.correlationId ?? randomUUID(),
        tenantId: event.tenantId,
        actorId: event.actorId,
      },
      () =>
        this.unitOfWork.execute(async () => {
          const claimed = await this.inbox.claim(event.eventId, this.consumer);
          if (!claimed) {
            this.logger.debug(
              `Skipping ${event.eventType} ${event.eventId} — already processed`,
            );
            return;
          }
          await this.onEvent(event);
        }),
    );
  }

  protected abstract onEvent(event: TEvent): Promise<void>;
}

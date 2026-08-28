import { Injectable } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { DomainEventEnvelope } from '../../contracts/events/domain-event';
import { EventTransport } from './event-transport.port';

/**
 * Adapter #1 — delivery without a broker.
 *
 * Handlers are ordinary `@EventsHandler` classes, so they never learn which
 * transport carried the event. Swapping `EVENT_TRANSPORT` for the RabbitMQ
 * adapter changes where a handler runs, never when: both are downstream of the
 * relay, so both are post-commit.
 *
 * `EventBus` routes on the published instance's constructor, so what arrives
 * here must be a `DomainEvent` subclass instance rather than a rebuilt literal.
 */
@Injectable()
export class InProcessEventTransport implements EventTransport {
  constructor(private readonly eventBus: EventBus) {}

  publish(event: DomainEventEnvelope): Promise<void> {
    this.eventBus.publish(event);
    return Promise.resolve();
  }
}

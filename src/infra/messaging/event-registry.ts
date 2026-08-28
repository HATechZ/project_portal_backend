import { Injectable, Logger } from '@nestjs/common';
import {
  DomainEvent,
  DomainEventEnvelope,
  DomainEventType,
} from '../../contracts/events/domain-event';
import { DOMAIN_EVENT_TYPES } from '../../contracts/events/registry';

/**
 * Turns a stored outbox row back into the class it was raised as.
 *
 * This exists because of how `@nestjs/cqrs` routes: `EventBus` matches handlers
 * on `Object.getPrototypeOf(event).constructor`, so an envelope replayed as a
 * plain object literal has constructor `Object` and reaches no handler at all —
 * silently, with no error anywhere. The relay must restore the prototype.
 */
@Injectable()
export class EventRegistry {
  private readonly logger = new Logger(EventRegistry.name);
  private readonly byType = new Map<string, DomainEventType>();

  constructor() {
    for (const type of DOMAIN_EVENT_TYPES) {
      this.byType.set(type.name, type);
    }
  }

  /**
   * Rebuilds without invoking the constructor: identity and time already live
   * in the row, and re-running a constructor would mint a fresh `eventId` and
   * `occurredAt`, quietly breaking dedupe.
   */
  rebuild(envelope: DomainEventEnvelope): DomainEvent | null {
    const type = this.byType.get(envelope.eventType);
    if (!type) {
      this.logger.error(
        `No contract class registered for "${envelope.eventType}" — add it to DOMAIN_EVENT_TYPES. Event ${envelope.eventId} cannot be delivered in-process.`,
      );
      return null;
    }
    const prototype = type.prototype as object;
    return Object.assign(Object.create(prototype) as DomainEvent, envelope);
  }

  knows(eventType: string): boolean {
    return this.byType.has(eventType);
  }
}

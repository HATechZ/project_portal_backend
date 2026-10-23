import { Injectable } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { EVENTS_HANDLER_METADATA } from '@nestjs/cqrs/dist/decorators/constants';
import { DomainEvent } from '../../contracts/events/domain-event';

interface RegisteredEventHandler {
  handle(event: DomainEvent): Promise<void> | void;
}

/**
 * The Rabbit worker needs an awaitable dispatch path: CQRS EventBus intentionally
 * isolates handler failures, which is right for in-process notifications but
 * would ACK a broker delivery before a handler's transaction had succeeded.
 */
@Injectable()
export class RabbitMqEventDispatcher {
  constructor(private readonly discovery: DiscoveryService) {}

  async dispatch(event: DomainEvent): Promise<void> {
    const handlers = this.discovery
      .getProviders()
      .filter((wrapper) => this.handles(wrapper.instance, event));

    await Promise.all(
      handlers.map(async (wrapper) => {
        await (wrapper.instance as RegisteredEventHandler).handle(event);
      }),
    );
  }

  private handles(
    instance: unknown,
    event: DomainEvent,
  ): instance is RegisteredEventHandler {
    if (
      !instance ||
      typeof instance !== 'object' ||
      typeof (instance as RegisteredEventHandler).handle !== 'function'
    )
      return false;

    const eventTypes = Reflect.getMetadata(
      EVENTS_HANDLER_METADATA,
      instance.constructor,
    ) as Array<new (...args: never[]) => DomainEvent> | undefined;
    return eventTypes?.some((eventType) => event instanceof eventType) ?? false;
  }
}

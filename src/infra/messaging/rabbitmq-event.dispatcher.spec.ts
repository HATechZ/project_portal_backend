import { EventsHandler } from '@nestjs/cqrs';
import { DiscoveryService } from '@nestjs/core';
import {
  DomainEvent,
  DomainEventOrigin,
} from '../../contracts/events/domain-event';
import { RabbitMqEventDispatcher } from './rabbitmq-event.dispatcher';

class TestEvent extends DomainEvent {
  readonly eventType = 'TestEvent';
  readonly routingKey = 'test.event';
  readonly payload = { value: 'ok' };

  constructor(origin: DomainEventOrigin) {
    super(origin);
  }
}

@EventsHandler(TestEvent)
class TestHandler {
  readonly handle = jest.fn().mockResolvedValue(undefined);
}

describe('RabbitMqEventDispatcher', () => {
  it('awaits the same decorated handler shape used by idempotent consumers', async () => {
    const handler = new TestHandler();
    const discovery = {
      getProviders: jest.fn().mockReturnValue([{ instance: handler }]),
    } as unknown as DiscoveryService;
    const target = new RabbitMqEventDispatcher(discovery);
    const event = new TestEvent({ tenantId: 'tenant-id' });

    await target.dispatch(event);

    expect(handler.handle).toHaveBeenCalledWith(event);
  });
});

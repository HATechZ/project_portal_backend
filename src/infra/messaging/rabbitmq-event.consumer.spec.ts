import {
  DomainEvent,
  DomainEventOrigin,
} from '../../contracts/events/domain-event';
import { ConfigService } from '@nestjs/config';
import { ConsumeMessage } from 'amqplib';
import type { AppConfiguration } from '../../config/configuration';
import { EventRegistry } from './event-registry';
import { RabbitMqEventConsumer } from './rabbitmq-event.consumer';
import { RabbitMqEventDispatcher } from './rabbitmq-event.dispatcher';

class TestEvent extends DomainEvent {
  readonly eventType = 'TestEvent';
  readonly routingKey = 'test.event';
  readonly payload = { value: 'ok' };

  constructor(origin: DomainEventOrigin) {
    super(origin);
  }
}

const envelope = {
  eventId: '2e4e65bc-7a16-4a6f-b6d8-20b3c6c5c2b0',
  eventType: 'TestEvent',
  routingKey: 'test.event',
  tenantId: '0a1b0db9-c5a7-431f-bdfb-c30b38b221cd',
  occurredAt: '2026-10-23T00:00:00.000Z',
  payload: { value: 'ok' },
};

function message(headers: Record<string, unknown> = {}): ConsumeMessage {
  return {
    content: Buffer.from(JSON.stringify(envelope)),
    properties: { headers: { 'x-tenant-id': envelope.tenantId, ...headers } },
  } as unknown as ConsumeMessage;
}

function subject(options?: { throws?: boolean; maxAttempts?: number }) {
  const config = {
    get: jest.fn().mockReturnValue({
      transport: 'rabbitmq',
      rabbitmqConsumerEnabled: true,
      rabbitmqConsumerQueue: 'portal.events.application',
      rabbitmqRetryDelayMs: 100,
      rabbitmqMaxAttempts: options?.maxAttempts ?? 3,
      rabbitmqUrl: 'amqp://portal:portal@127.0.0.1:5672',
    }),
  } as unknown as ConfigService<AppConfiguration, true>;
  const registry = {
    rebuild: jest.fn().mockReturnValue(new TestEvent(envelope)),
  } as unknown as EventRegistry;
  const dispatch = options?.throws
    ? jest.fn().mockRejectedValue(new Error('handler failed'))
    : jest.fn().mockResolvedValue(undefined);
  const dispatcher = { dispatch } as unknown as RabbitMqEventDispatcher;
  const target = new RabbitMqEventConsumer(config, registry, dispatcher);
  const channel = {
    ack: jest.fn(),
    nack: jest.fn(),
    publish: jest.fn().mockResolvedValue(true),
  };
  (target as unknown as { channel: typeof channel }).channel = channel;
  return { target, channel, dispatch, registry };
}

describe('RabbitMqEventConsumer', () => {
  it('acknowledges only after the awaitable dispatcher completes', async () => {
    const { target, channel, dispatch } = subject();
    const delivery = message();

    await target.handleDelivery(delivery);

    expect(dispatch).toHaveBeenCalledWith(expect.any(TestEvent));
    expect(channel.ack).toHaveBeenCalledWith(delivery);
  });

  it('sends a failed delivery through the delayed retry exchange before acking it', async () => {
    const { target, channel } = subject({ throws: true });
    const delivery = message();

    await target.handleDelivery(delivery);

    expect(channel.publish).toHaveBeenCalledWith(
      'portal.events.retry',
      envelope.routingKey,
      delivery.content,
      {
        persistent: true,
        contentType: 'application/json',
        headers: { 'x-tenant-id': envelope.tenantId, 'x-retry-count': 1 },
      },
    );
    expect(channel.ack).toHaveBeenCalledWith(delivery);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('dead-letters a delivery after the configured retry budget is exhausted', async () => {
    const { target, channel } = subject({ throws: true, maxAttempts: 2 });
    const delivery = message({ 'x-retry-count': 1 });

    await target.handleDelivery(delivery);

    expect(channel.nack).toHaveBeenCalledWith(delivery, false, false);
    expect(channel.ack).not.toHaveBeenCalled();
  });
});

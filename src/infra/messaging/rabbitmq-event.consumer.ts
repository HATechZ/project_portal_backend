import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AmqpConnectionManager,
  Channel as AmqpChannel,
  ChannelWrapper,
  connect,
} from 'amqp-connection-manager';
import { ConsumeMessage } from 'amqplib';
import type { AppConfiguration } from '../../config/configuration';
import { DomainEventEnvelope } from '../../contracts/events/domain-event';
import { EventRegistry } from './event-registry';
import { EVENT_RETRY_EXCHANGE } from './messaging.constants';
import { RabbitMqEventDispatcher } from './rabbitmq-event.dispatcher';
import { declareRabbitMqTopology } from './rabbitmq-topology';

const RETRY_COUNT_HEADER = 'x-retry-count';

/** A durable RabbitMQ worker with delayed retry and a per-consumer DLQ. */
@Injectable()
export class RabbitMqEventConsumer
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(RabbitMqEventConsumer.name);
  private readonly enabled: boolean;
  private readonly queue: string;
  private connection?: AmqpConnectionManager;
  private channel?: ChannelWrapper;

  constructor(
    private readonly config: ConfigService<AppConfiguration, true>,
    private readonly registry: EventRegistry,
    private readonly dispatcher: RabbitMqEventDispatcher,
  ) {
    const messaging = config.get('messaging', { infer: true });
    this.enabled =
      messaging.transport === 'rabbitmq' && messaging.rabbitmqConsumerEnabled;
    this.queue = messaging.rabbitmqConsumerQueue;
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.enabled) return;
    const messaging = this.config.get('messaging', { infer: true });
    this.connection = connect([messaging.rabbitmqUrl]);
    this.channel = this.connection.createChannel({
      name: `${this.queue}-consumer`,
      json: false,
      setup: (channel: AmqpChannel) => this.setup(channel),
    });
    await this.channel.waitForConnect();
    await this.channel.consume(
      this.queue,
      (message) => {
        if (message) void this.handleDelivery(message);
      },
      { noAck: false, prefetch: 1 },
    );
    this.logger.log(`RabbitMQ consumer started — queue: ${this.queue}`);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }

  /** Public for focused transport tests; normal calls only come from AMQP. */
  async handleDelivery(message: ConsumeMessage): Promise<void> {
    const channel = this.channel;
    if (!channel) return;
    const envelope = parseEnvelope(message);
    if (!envelope) {
      this.logger.error('Malformed RabbitMQ event sent to DLQ');
      channel.nack(message, false, false);
      return;
    }

    const event = this.registry.rebuild(envelope);
    if (!event) {
      // Publishers may outpace a consumer deploy. An unhandled event is normal;
      // retaining it indefinitely would block the one queue this worker owns.
      channel.ack(message);
      return;
    }

    try {
      await this.dispatcher.dispatch(event);
      channel.ack(message);
    } catch (error) {
      await this.retryOrDeadLetter(message, envelope, error);
    }
  }

  private async setup(channel: AmqpChannel): Promise<void> {
    await declareRabbitMqTopology(
      channel,
      this.config.get('messaging', { infer: true }),
    );
  }

  private async retryOrDeadLetter(
    message: ConsumeMessage,
    envelope: DomainEventEnvelope,
    error: unknown,
  ): Promise<void> {
    const channel = this.channel!;
    const { rabbitmqMaxAttempts } = this.config.get('messaging', {
      infer: true,
    });
    const attempts = retryCount(message) + 1;
    if (attempts >= rabbitmqMaxAttempts) {
      this.logger.error(
        `Event ${envelope.eventId} exhausted ${attempts} attempts; sent to DLQ`,
        error instanceof Error ? error.stack : String(error),
      );
      channel.nack(message, false, false);
      return;
    }

    try {
      await channel.publish(
        EVENT_RETRY_EXCHANGE,
        envelope.routingKey,
        message.content,
        {
          persistent: true,
          contentType: 'application/json',
          headers: {
            ...message.properties.headers,
            [RETRY_COUNT_HEADER]: attempts,
          },
        },
      );
      channel.ack(message);
      this.logger.warn(
        `Event ${envelope.eventId} failed; retry ${attempts}/${rabbitmqMaxAttempts - 1} queued`,
      );
    } catch (publishError) {
      // The original delivery remains authoritative if retry publication fails.
      // Requeueing preserves at-least-once delivery across a broker reconnect.
      this.logger.error(
        `Could not schedule retry for ${envelope.eventId}; requeueing original`,
        publishError instanceof Error
          ? publishError.stack
          : String(publishError),
      );
      channel.nack(message, false, true);
    }
  }
}

function parseEnvelope(message: ConsumeMessage): DomainEventEnvelope | null {
  try {
    const value = JSON.parse(message.content.toString()) as DomainEventEnvelope;
    if (
      !value ||
      typeof value.eventId !== 'string' ||
      typeof value.eventType !== 'string' ||
      typeof value.routingKey !== 'string' ||
      typeof value.tenantId !== 'string' ||
      typeof value.occurredAt !== 'string' ||
      !value.payload ||
      typeof value.payload !== 'object'
    )
      return null;
    const headerTenantId: unknown = message.properties.headers?.['x-tenant-id'];
    return typeof headerTenantId !== 'string' ||
      headerTenantId === value.tenantId
      ? value
      : null;
  } catch {
    return null;
  }
}

function retryCount(message: ConsumeMessage): number {
  const value: unknown = message.properties.headers?.[RETRY_COUNT_HEADER];
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
}

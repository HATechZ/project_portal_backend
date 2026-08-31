import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AmqpConnectionManager,
  ChannelWrapper,
  connect,
} from 'amqp-connection-manager';
import { Channel } from 'amqplib';
import type { AppConfiguration } from '../../config/configuration';
import { DomainEventEnvelope } from '../../contracts/events/domain-event';
import { EventTransport } from './event-transport.port';

const EXCHANGE = 'portal.events';
const DLX = 'portal.events.dlx';

/**
 * Adapter #2 — delivery via RabbitMQ.
 *
 * Selected when MESSAGING_TRANSPORT=rabbitmq. When in-process is selected
 * this class is still registered but never connects: the constructor skips
 * setup and every lifecycle hook is a no-op.
 *
 * Topology:
 *   portal.events.dlx (topic, durable) ← dead-letters land here
 *   portal.events      (topic, durable) → x-dead-letter-exchange points to DLX
 *
 * Tenant identity and causality travel in AMQP headers, never in the routing
 * key. The routing key is the event's `routingKey` field (e.g.
 * "user.created"), which stays stable across tenants.
 */
@Injectable()
export class RabbitMqEventTransport
  implements EventTransport, OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(RabbitMqEventTransport.name);
  private connection?: AmqpConnectionManager;
  private channel?: ChannelWrapper;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService<AppConfiguration>) {
    this.enabled =
      config.get('messaging.transport', { infer: true }) === 'rabbitmq';

    if (!this.enabled) return;

    const url = config.get('messaging.rabbitmqUrl', { infer: true }) ?? '';
    this.connection = connect([url]);
    this.channel = this.connection.createChannel({
      json: false,
      setup: async (ch: Channel) => {
        await ch.assertExchange(DLX, 'topic', { durable: true });
        await ch.assertExchange(EXCHANGE, 'topic', {
          durable: true,
          arguments: { 'x-dead-letter-exchange': DLX },
        });
      },
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.enabled) return;
    await this.channel?.waitForConnect();
    this.logger.log(`Connected to RabbitMQ — exchange: ${EXCHANGE}`);
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.enabled) return;
    await this.channel?.close();
    await this.connection?.close();
  }

  async publish(event: DomainEventEnvelope): Promise<void> {
    if (!this.enabled) return;
    await this.channel!.publish(
      EXCHANGE,
      event.routingKey,
      Buffer.from(JSON.stringify(event)),
      {
        persistent: true,
        contentType: 'application/json',
        headers: {
          'x-tenant-id': event.tenantId,
          'x-correlation-id': event.correlationId ?? null,
          'x-event-type': event.eventType,
        },
      },
    );
  }
}

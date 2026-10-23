import { Channel as AmqpChannel } from 'amqp-connection-manager';
import type { AppConfiguration } from '../../config/configuration';
import {
  EVENT_DEAD_LETTER_EXCHANGE,
  EVENT_EXCHANGE,
  EVENT_RETRY_EXCHANGE,
} from './messaging.constants';

/**
 * Declared by both the publisher and the worker. This makes a durable queue
 * exist before the relay can stamp a broker publish as successful, even when
 * the worker process has not started yet.
 */
export async function declareRabbitMqTopology(
  channel: AmqpChannel,
  messaging: AppConfiguration['messaging'],
): Promise<void> {
  const queue = messaging.rabbitmqConsumerQueue;
  await channel.assertExchange(EVENT_EXCHANGE, 'topic', { durable: true });
  await channel.assertExchange(EVENT_DEAD_LETTER_EXCHANGE, 'topic', {
    durable: true,
  });
  await channel.assertExchange(EVENT_RETRY_EXCHANGE, 'topic', {
    durable: true,
  });
  await channel.assertQueue(queue, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': EVENT_DEAD_LETTER_EXCHANGE,
      'x-dead-letter-routing-key': queue,
    },
  });
  await channel.bindQueue(queue, EVENT_EXCHANGE, '#');
  await channel.assertQueue(`${queue}.retry`, {
    durable: true,
    arguments: {
      'x-message-ttl': messaging.rabbitmqRetryDelayMs,
      'x-dead-letter-exchange': EVENT_EXCHANGE,
    },
  });
  await channel.bindQueue(`${queue}.retry`, EVENT_RETRY_EXCHANGE, '#');
  await channel.assertQueue(`${queue}.dlq`, { durable: true });
  await channel.bindQueue(`${queue}.dlq`, EVENT_DEAD_LETTER_EXCHANGE, queue);
}

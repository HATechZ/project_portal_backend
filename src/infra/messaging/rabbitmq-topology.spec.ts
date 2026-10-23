import { declareRabbitMqTopology } from './rabbitmq-topology';

describe('declareRabbitMqTopology', () => {
  it('declares a durable main queue, delayed retry queue, and DLQ before publish', async () => {
    const channel = {
      assertExchange: jest.fn().mockResolvedValue(undefined),
      assertQueue: jest.fn().mockResolvedValue(undefined),
      bindQueue: jest.fn().mockResolvedValue(undefined),
    };

    await declareRabbitMqTopology(
      channel as never,
      {
        rabbitmqConsumerQueue: 'application',
        rabbitmqRetryDelayMs: 1000,
      } as never,
    );

    expect(channel.assertQueue).toHaveBeenCalledWith('application', {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'portal.events.dlx',
        'x-dead-letter-routing-key': 'application',
      },
    });
    expect(channel.assertQueue).toHaveBeenCalledWith('application.retry', {
      durable: true,
      arguments: {
        'x-message-ttl': 1000,
        'x-dead-letter-exchange': 'portal.events',
      },
    });
    expect(channel.bindQueue).toHaveBeenCalledWith(
      'application.dlq',
      'portal.events.dlx',
      'application',
    );
  });
});

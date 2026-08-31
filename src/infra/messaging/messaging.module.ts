import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import type { AppConfiguration } from '../../config/configuration';
import { EventRegistry } from './event-registry';
import { EVENT_TRANSPORT } from './event-transport.port';
import { InboxRepository } from './inbox.repository';
import { InProcessEventTransport } from './in-process-event.transport';
import { EVENT_REGISTRY } from './messaging.constants';
import { OutboxRelayService } from './outbox-relay.service';
import { OutboxRepository } from './outbox.repository';
import { OutboxService } from './outbox.service';
import { RabbitMqEventTransport } from './rabbitmq-event.transport';

/**
 * Global so any module can raise an event without importing a messaging module
 * — importing one to publish would recreate the coupling Art. XI removes.
 *
 * `OutboxService` and `InboxRepository` are exported; `EVENT_TRANSPORT` and the
 * relay are not. A producer that could reach the transport could publish inside
 * its own transaction, and only the relay may stamp `publishedAt`.
 *
 * `CqrsModule` is re-exported so feature modules can declare `@EventsHandler`
 * classes without depending on `@nestjs/cqrs` registration themselves.
 *
 * Transport selection: MESSAGING_TRANSPORT=rabbitmq switches to the broker
 * adapter; the default is in-process. RabbitMqEventTransport is always
 * registered so NestJS manages its lifecycle — it connects only when enabled.
 */
@Global()
@Module({
  imports: [CqrsModule.forRoot()],
  providers: [
    EventRegistry,
    InProcessEventTransport,
    RabbitMqEventTransport,
    OutboxRepository,
    OutboxService,
    InboxRepository,
    OutboxRelayService,
    { provide: EVENT_REGISTRY, useExisting: EventRegistry },
    {
      provide: EVENT_TRANSPORT,
      inject: [ConfigService, InProcessEventTransport, RabbitMqEventTransport],
      useFactory: (
        config: ConfigService<AppConfiguration>,
        inProcess: InProcessEventTransport,
        rabbitmq: RabbitMqEventTransport,
      ) =>
        config.get('messaging.transport', { infer: true }) === 'rabbitmq'
          ? rabbitmq
          : inProcess,
    },
  ],
  exports: [CqrsModule, EVENT_REGISTRY, OutboxService, InboxRepository],
})
export class MessagingModule {}

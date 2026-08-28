import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { EventRegistry } from './event-registry';
import { EVENT_TRANSPORT } from './event-transport.port';
import { InboxRepository } from './inbox.repository';
import { InProcessEventTransport } from './in-process-event.transport';
import { EVENT_REGISTRY } from './messaging.constants';
import { OutboxRelayService } from './outbox-relay.service';
import { OutboxRepository } from './outbox.repository';
import { OutboxService } from './outbox.service';

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
 */
@Global()
@Module({
  imports: [CqrsModule.forRoot()],
  providers: [
    EventRegistry,
    InProcessEventTransport,
    OutboxRepository,
    OutboxService,
    InboxRepository,
    OutboxRelayService,
    { provide: EVENT_REGISTRY, useExisting: EventRegistry },
    { provide: EVENT_TRANSPORT, useExisting: InProcessEventTransport },
  ],
  exports: [CqrsModule, EVENT_REGISTRY, OutboxService, InboxRepository],
})
export class MessagingModule {}

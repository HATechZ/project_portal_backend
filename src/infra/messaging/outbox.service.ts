import { Injectable } from '@nestjs/common';
import { DomainEvent } from '../../contracts/events/domain-event';
import { OutboxRepository } from './outbox.repository';

/**
 * The only thing a producer ever touches to raise an event.
 *
 * It deliberately has no access to the transport token. A producer that could
 * reach the transport could publish inside its own transaction, which is the
 * failure this module exists to make impossible: the broker cannot roll back,
 * so an announced fact would outlive the transaction that never committed.
 *
 * Call it inside `UnitOfWorkService.execute`, alongside the domain write.
 */
@Injectable()
export class OutboxService {
  constructor(private readonly repository: OutboxRepository) {}

  enqueue(event: DomainEvent): Promise<void> {
    return this.repository.enqueue(event);
  }

  async enqueueAll(events: readonly DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.repository.enqueue(event);
    }
  }
}

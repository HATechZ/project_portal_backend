import { DomainEvent, DomainEventOrigin } from './domain-event';

export class BidCreated extends DomainEvent<{ bidId: string }> {
  readonly eventType = 'BidCreated';
  readonly routingKey = 'bid.created';
  constructor(
    origin: DomainEventOrigin,
    readonly payload: { bidId: string },
  ) {
    super(origin);
  }
}

export class BidUpdated extends DomainEvent<{ bidId: string }> {
  readonly eventType = 'BidUpdated';
  readonly routingKey = 'bid.updated';
  constructor(
    origin: DomainEventOrigin,
    readonly payload: { bidId: string },
  ) {
    super(origin);
  }
}

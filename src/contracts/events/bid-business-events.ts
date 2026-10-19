import { DomainEvent, DomainEventOrigin } from './domain-event';

export class BidBusinessOutcomeDecided extends DomainEvent<{
  bidId: string;
  cycleId: string;
  outcome: 'WIN' | 'LOSE';
}> {
  readonly eventType = 'BidBusinessOutcomeDecided';
  readonly routingKey = 'bid.business-outcome.decided';
  constructor(
    origin: DomainEventOrigin,
    readonly payload: {
      bidId: string;
      cycleId: string;
      outcome: 'WIN' | 'LOSE';
    },
  ) {
    super(origin);
  }
}

export class BidConvertedToProject extends DomainEvent<{
  bidId: string;
  projectId: string;
  cycleId: string;
}> {
  readonly eventType = 'BidConvertedToProject';
  readonly routingKey = 'bid.converted-to-project';
  constructor(
    origin: DomainEventOrigin,
    readonly payload: { bidId: string; projectId: string; cycleId: string },
  ) {
    super(origin);
  }
}

export class BidArchivedReviewRequested extends DomainEvent<{
  bidId: string;
  reviewRequestId: string;
}> {
  readonly eventType = 'BidArchivedReviewRequested';
  readonly routingKey = 'bid.archived-review.requested';
  constructor(
    origin: DomainEventOrigin,
    readonly payload: { bidId: string; reviewRequestId: string },
  ) {
    super(origin);
  }
}

export class BidBusinessCycleOpened extends DomainEvent<{
  bidId: string;
  cycleId: string;
  cycleNumber: number;
}> {
  readonly eventType = 'BidBusinessCycleOpened';
  readonly routingKey = 'bid.business-cycle.opened';
  constructor(
    origin: DomainEventOrigin,
    readonly payload: { bidId: string; cycleId: string; cycleNumber: number },
  ) {
    super(origin);
  }
}

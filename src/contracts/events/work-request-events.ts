import { DomainEvent, DomainEventOrigin } from './domain-event';

export class WorkRequestTransitioned extends DomainEvent<{
  workRequestId: string;
  action: string;
  priorState: string;
  resultingState: string;
}> {
  readonly eventType = 'WorkRequestTransitioned';
  readonly routingKey = 'work-request.transitioned';

  constructor(
    origin: DomainEventOrigin,
    readonly payload: {
      workRequestId: string;
      action: string;
      priorState: string;
      resultingState: string;
    },
  ) {
    super(origin);
  }
}

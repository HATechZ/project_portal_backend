import { DomainEvent, DomainEventOrigin } from './domain-event';
export class ProjectCreated extends DomainEvent<{ projectId: string }> {
  readonly eventType = 'ProjectCreated';
  readonly routingKey = 'project.created';
  constructor(
    origin: DomainEventOrigin,
    readonly payload: { projectId: string },
  ) {
    super(origin);
  }
}
export class ProjectUpdated extends DomainEvent<{ projectId: string }> {
  readonly eventType = 'ProjectUpdated';
  readonly routingKey = 'project.updated';
  constructor(
    origin: DomainEventOrigin,
    readonly payload: { projectId: string },
  ) {
    super(origin);
  }
}
export class ProjectStatusChanged extends DomainEvent<{
  projectId: string;
  status: 'ACTIVE';
}> {
  readonly eventType = 'ProjectStatusChanged';
  readonly routingKey = 'project.status.changed';
  constructor(
    origin: DomainEventOrigin,
    readonly payload: { projectId: string; status: 'ACTIVE' },
  ) {
    super(origin);
  }
}

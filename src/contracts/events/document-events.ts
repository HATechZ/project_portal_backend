import { DomainEvent, DomainEventOrigin } from './domain-event';

export class DocumentVersionCreated extends DomainEvent<{
  owner: 'BID' | 'PROJECT' | 'WORK_REQUEST';
  parentId: string;
  documentId: string;
  versionId: string;
}> {
  readonly eventType = 'DocumentVersionCreated';
  readonly routingKey = 'document.version.created';

  constructor(
    origin: DomainEventOrigin,
    readonly payload: {
      owner: 'BID' | 'PROJECT' | 'WORK_REQUEST';
      parentId: string;
      documentId: string;
      versionId: string;
    },
  ) {
    super(origin);
  }
}

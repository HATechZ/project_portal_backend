import {
  DomainEvent,
  DomainEventOrigin,
} from '../../contracts/events/domain-event';
import { RequestContext } from '../../common/context/request-context';
import { EventHandlerBase } from './event-handler.base';
import { InboxRepository } from './inbox.repository';
import { UnitOfWorkService } from '../prisma/unit-of-work.service';

class TestEvent extends DomainEvent {
  readonly eventType = 'TestEvent';
  readonly routingKey = 'test.event';
  readonly payload = { value: 'ok' };

  constructor(origin: DomainEventOrigin) {
    super(origin);
  }
}

class TestHandler extends EventHandlerBase<TestEvent> {
  protected readonly consumer = 'test-consumer';
  readonly onEvent = jest.fn().mockResolvedValue(undefined);
}

describe('EventHandlerBase', () => {
  it('claims and handles an event in one tenant-scoped unit of work', async () => {
    const claim = jest.fn().mockResolvedValue(true);
    const execute = jest
      .fn()
      .mockImplementation((work: () => Promise<unknown>) => work());
    const inbox = { claim } as unknown as InboxRepository;
    const unitOfWork = { execute } as unknown as UnitOfWorkService;
    const target = new TestHandler(inbox, unitOfWork);
    const event = new TestEvent({ tenantId: 'tenant-id', eventId: 'event-id' });

    await target.handle(event);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(claim).toHaveBeenCalledWith('event-id', 'test-consumer');
    expect(target.onEvent).toHaveBeenCalledWith(event);
    expect(RequestContext.tenantId()).toBeUndefined();
  });

  it('skips duplicate delivery before invoking the side effect', async () => {
    const claim = jest.fn().mockResolvedValue(false);
    const execute = jest
      .fn()
      .mockImplementation((work: () => Promise<unknown>) => work());
    const inbox = { claim } as unknown as InboxRepository;
    const unitOfWork = { execute } as unknown as UnitOfWorkService;
    const target = new TestHandler(inbox, unitOfWork);

    await target.handle(new TestEvent({ tenantId: 'tenant-id' }));

    expect(target.onEvent).not.toHaveBeenCalled();
  });
});

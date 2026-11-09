import { RequestContext } from '../../common/context/request-context';
import { WorkRequestCommunicationRepository } from './work-request-communication.repository';

describe('WorkRequestCommunicationRepository Phase 6 pair persistence', () => {
  const context = <T>(work: () => Promise<T>) => RequestContext.run({ tenantId: 'tenant-a', requestId: 'communication-test' }, work);
  it('canonicalizes the pair and stores separate immutable messages for fan-out', async () => {
    const conversationCreate = jest.fn().mockResolvedValue({ id: 'conversation-a' });
    const messageCreate = jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, attachments: data.attachments.create.map((item: any) => ({ documentVersionId: item.documentVersionId })) }));
    const db = {
      workRequestRoute: { findFirst: jest.fn().mockResolvedValue({ id: 'route-a' }) },
      workRequestRouteConversation: { findFirst: jest.fn().mockResolvedValue(null), create: conversationCreate },
      workRequestRouteMessage: { findFirst: jest.fn().mockResolvedValue(null), create: messageCreate },
    };
    const subject = new WorkRequestCommunicationRepository({ execute: (work: (executor: never) => Promise<unknown>) => work(db as never) } as never);
    await context(() => subject.send('request-a', 'actor-z', ['actor-a'], 'A private message', ['version-a'], 'key', undefined));
    expect(conversationCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ firstParticipantActorId: 'actor-a', secondParticipantActorId: 'actor-z' }) }));
    expect(messageCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sequenceNumber: 1, senderActorId: 'actor-z', recipientActorId: 'actor-a', attachments: expect.objectContaining({ create: [expect.objectContaining({ documentVersionId: 'version-a' })] }) }) }));
  });

  it('orders main lifecycle occurrences and exposes the active division cycle projection', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      projection: { routeVersionId: 'version-a', routeStepId: 'step-a', divisionCycleId: 'cycle-a', updatedAt: new Date('2026-01-01T00:00:00.000Z') },
      steps: [],
    });
    const subject = new WorkRequestCommunicationRepository({
      execute: (work: (executor: never) => Promise<unknown>) =>
        work({ workRequestRoute: { findFirst } } as never),
    } as never);

    const result = await context(() => subject.history('request-a', 'actor-a', false));

    expect(result).toEqual(
      expect.objectContaining({
        projection: expect.objectContaining({ divisionCycleId: 'cycle-a' }),
      }),
    );

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          steps: expect.objectContaining({ orderBy: { ordinal: 'asc' } }),
        }),
      }),
    );
  });

  it('returns each route Division name and the exact persisted execution pointers', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      projection: { routeVersionId: 'version-a', routeStepId: 'step-a', divisionCycleId: 'cycle-a', teamStepId: 'team-step-a', memberStepId: null, updatedAt: new Date('2026-01-01T00:00:00.000Z') },
      steps: [
        { id: 'step-a', ordinal: 1, divisionId: 'division-a', division: { name: 'Engineering' } },
        { id: 'step-b', ordinal: 2, divisionId: null, division: null },
      ],
    });
    const subject = new WorkRequestCommunicationRepository({ execute: (work: (executor: never) => Promise<unknown>) => work({ workRequestRoute: { findFirst } } as never) } as never);
    const result = await context(() => subject.history('request-a', 'actor-a', false, true));
    expect(result).toMatchObject({ projection: { divisionCycleId: 'cycle-a', teamStepId: 'team-step-a', memberStepId: null }, steps: [{ divisionId: 'division-a', divisionName: 'Engineering' }, { divisionId: null, divisionName: null }] });
    expect(findFirst.mock.calls[0][0].include.steps.select.division.select).toEqual({ name: true });
    const main = await context(() => subject.history('request-a', 'actor-a', false));
    expect(main?.projection).not.toHaveProperty('teamStepId');
    expect(main?.projection).not.toHaveProperty('memberStepId');
  });
});

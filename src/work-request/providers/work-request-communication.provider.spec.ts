import { RequestContext } from '../../common/context/request-context';
import { WorkRequestCommunicationProvider } from './work-request-communication.provider';

describe('WorkRequestCommunicationProvider Phase 6 privacy', () => {
  const actor = { id: 'actor-a', member: { id: 'member-a', isActive: true } } as never;
  const context = <T>(work: () => Promise<T>) => RequestContext.run({ tenantId: 'tenant-a', requestId: '11111111-1111-4111-8111-111111111111' }, work);

  it('fans one initial send into independent private recipient messages', async () => {
    const send = jest.fn().mockResolvedValue([
      { id: 'message-b', conversationId: 'conversation-b', sequenceNumber: 1, senderActorId: 'actor-a', recipientActorId: 'actor-b', body: 'Need detail', sentAt: new Date(), attachments: [] },
      { id: 'message-c', conversationId: 'conversation-c', sequenceNumber: 1, senderActorId: 'actor-a', recipientActorId: 'actor-c', body: 'Need detail', sentAt: new Date(), attachments: [] },
    ]);
    const provider = new WorkRequestCommunicationProvider({ recipientActorIds: jest.fn().mockResolvedValue([{ id: 'actor-b' }, { id: 'actor-c' }]), hasDocumentVersions: jest.fn().mockResolvedValue(true), send } as never, {} as never);
    const result = await context(() => provider.send('request-a', ['actor-b', 'actor-c'], 'Need detail', [], actor));
    expect(send).toHaveBeenCalledWith('request-a', 'actor-a', ['actor-b', 'actor-c'], 'Need detail', [], expect.any(String), expect.any(String));
    expect(result).toHaveLength(2);
    expect(result.map((item) => item.conversationId)).toEqual(['conversation-b', 'conversation-c']);
  });

  it('gives a former or unrelated participant no send path while retaining repository-backed reads', async () => {
    const repository = { recipientActorIds: jest.fn().mockResolvedValue([]), hasDocumentVersions: jest.fn(), send: jest.fn(), conversation: jest.fn().mockResolvedValue({ id: 'conversation-a', messages: [] }) };
    const provider = new WorkRequestCommunicationProvider(repository as never, {} as never);
    await expect(context(() => provider.send('request-a', ['actor-b'], 'No longer related', [], actor))).rejects.toMatchObject({ status: 403 });
    await expect(context(() => provider.read('request-a', 'conversation-a', actor))).resolves.toEqual({ id: 'conversation-a', messages: [] });
    expect(repository.send).not.toHaveBeenCalled();
  });

  it('does not disclose a conversation to a non-participant', async () => {
    const provider = new WorkRequestCommunicationProvider({ conversation: jest.fn().mockResolvedValue(null) } as never, {} as never);
    await expect(context(() => provider.read('request-a', 'conversation-a', actor))).rejects.toMatchObject({ status: 404 });
  });

  it('does not disclose main or internal route projections to an unrelated actor', async () => {
    const provider = new WorkRequestCommunicationProvider({ isRelatedActor: jest.fn().mockResolvedValue(false), history: jest.fn() } as never, {} as never);
    await expect(context(() => provider.mainHistory('request-a', actor))).rejects.toMatchObject({ status: 403 });
    await expect(context(() => provider.internalHistory('request-a', actor))).rejects.toMatchObject({ status: 403 });
  });

  it('keeps main-history projection free of internal cycle and sequence identifiers', async () => {
    const provider = new WorkRequestCommunicationProvider({ isRelatedActor: jest.fn().mockResolvedValue(true), history: jest.fn().mockResolvedValue({ projection: { routeStepId: 'route-step-a', routeVersionId: 'version-a' }, steps: [] }) } as never, {} as never);
    await expect(context(() => provider.mainHistory('request-a', actor))).resolves.toEqual(expect.objectContaining({ projection: expect.not.objectContaining({ divisionCycleId: expect.anything(), teamStepId: expect.anything(), memberStepId: expect.anything() }) }));
  });

  it('uses Work Request visibility, rather than operational participation, for the route projection', async () => {
    const history = { projection: { routeStepId: 'route-step-a' }, steps: [] };
    const communications = { history: jest.fn().mockResolvedValue(history) };
    const reads = { find: jest.fn().mockResolvedValue({ id: 'request-a' }) };
    const provider = new WorkRequestCommunicationProvider(communications as never, reads as never);

    await expect(context(() => provider.routeProjection('request-a', actor))).resolves.toBe(history);
    expect(reads.find).toHaveBeenCalledWith('request-a', actor);
    expect(communications.history).toHaveBeenCalledWith('request-a', 'actor-a', false);
  });

  it('does not disclose a route projection when the Work Request visibility predicate rejects it', async () => {
    const communications = { history: jest.fn() };
    const reads = { find: jest.fn().mockResolvedValue(null) };
    const provider = new WorkRequestCommunicationProvider(communications as never, reads as never);

    await expect(context(() => provider.routeProjection('request-a', actor))).rejects.toMatchObject({ status: 404 });
    expect(communications.history).not.toHaveBeenCalled();
  });
});

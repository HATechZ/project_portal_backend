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
});

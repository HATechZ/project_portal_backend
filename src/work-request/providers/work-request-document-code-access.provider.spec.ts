import { describe, expect, it, jest } from '@jest/globals';
import { RequestContext } from '../../common/context/request-context';
import { WorkRequestServiceBase } from './work-request-service-base';

class Subject extends WorkRequestServiceBase {
  constructor(repository: unknown, reads: unknown) {
    super(
      repository as never,
      reads as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  }
}

const actor = {
  id: 'actor-a',
  isActive: true,
  role: { customScope: 'member' },
} as never;

describe('Work Request document-code selector access', () => {
  it('does not disclose choices to an internally unrelated uploader', async () => {
    const repository = {
      availableDocumentCodes: jest.fn().mockResolvedValue({
        parent: { clientId: 'client-a' },
        codes: [{ id: 'code-a' }],
      }),
    };
    const reads = { find: jest.fn().mockResolvedValue(null) };
    const subject = new Subject(repository, reads);

    await expect(
      RequestContext.run({ tenantId: 'tenant-a', requestId: 'request-a' }, () =>
        subject.availableDocumentCodes('work-request-a', actor),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('returns choices only after the existing scoped Work Request read allows access', async () => {
    const repository = {
      availableDocumentCodes: jest.fn().mockResolvedValue({
        parent: { clientId: 'client-a' },
        codes: [{ id: 'code-a', documentGroup: 'GENERAL' }],
      }),
    };
    const reads = {
      find: jest.fn().mockResolvedValue({ id: 'work-request-a' }),
    };
    const subject = new Subject(repository, reads);

    await expect(
      RequestContext.run({ tenantId: 'tenant-a', requestId: 'request-a' }, () =>
        subject.availableDocumentCodes('work-request-a', actor),
      ),
    ).resolves.toEqual([{ id: 'code-a', documentGroup: 'GENERAL' }]);
  });

  it('does not accept a standalone upload for an internally unrelated uploader', async () => {
    const repository = {
      prepareStandaloneDocuments: jest.fn().mockResolvedValue({
        parent: { clientId: 'client-a' },
        attachments: [],
      }),
    };
    const reads = { find: jest.fn().mockResolvedValue(null) };
    const subject = new Subject(repository, reads);

    await expect(
      RequestContext.run({ tenantId: 'tenant-a', requestId: 'request-a' }, () =>
        subject.createStandaloneDocuments(
          'work-request-a',
          [],
          [],
          undefined,
          undefined,
          actor,
        ),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});

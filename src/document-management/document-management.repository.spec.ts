import { RequestContext } from '../common/context/request-context';
import type { SessionActor } from '../common/security/session.types';
import { DocumentManagementRepository } from './document-management.repository';

const exactVersion = {
  id: 'version-packaged',
  storageKey: 'tenant-a/request-a/version-packaged',
  generatedFileName: 'approved.pdf',
  uploadedFileName: 'source.pdf',
  mimeType: 'application/pdf',
  fileSizeBytes: 42n,
  versionNumber: 1,
  revisionCode: '01',
  uploadedAt: new Date('2026-01-02T03:04:05.000Z'),
  uploadedByActorId: 'actor-a',
  workRequestV1DocumentId: 'document-a',
  document: { workRequestId: 'request-a' },
};

type C1Query = {
  where: {
    tenantId: string;
    documentVersionId: string;
    submission: {
      workRequest: {
        OR: readonly (
          | { bid: { is: { clientId: string } } }
          | { directProject: { is: { clientId: string } } }
        )[];
      };
    };
  };
};

type PackageResult = { documentVersion: typeof exactVersion } | null;
type C1Finder = jest.Mock<Promise<PackageResult>, [C1Query]>;

function externalActor(clientId = 'client-a'): SessionActor {
  return {
    id: 'contact-actor-a',
    clientContact: {
      id: 'contact-a',
      clientId,
      isActive: true,
      client: { isActive: true },
    },
  } as unknown as SessionActor;
}

function subject(findFirst: C1Finder): DocumentManagementRepository {
  const db = {
    workRequestV1ClientSubmissionItem: { findFirst },
    bidDocumentVersion: { findFirst: jest.fn() },
    directProjectDocumentVersion: { findFirst: jest.fn() },
    workRequestV1DocumentVersion: { findFirst: jest.fn() },
  };
  return new DocumentManagementRepository({
    execute: (work: (transaction: typeof db) => Promise<unknown>) => work(db),
  } as never);
}

function finder(result: PackageResult): C1Finder {
  return jest.fn<Promise<PackageResult>, [C1Query]>().mockResolvedValue(result);
}

describe('DocumentManagementRepository external C1 resolver', () => {
  it('keeps tree and search internal-only for a client contact', async () => {
    const findFirst = finder(null);
    const repository = subject(findFirst);

    await expect(
      repository.search('approved', externalActor()),
    ).resolves.toEqual([]);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('allows only an exact version recorded in a visible immutable C1 package', async () => {
    const findFirst = finder({ documentVersion: exactVersion });
    const repository = subject(findFirst);

    const found = await RequestContext.run(
      { tenantId: 'tenant-a', requestId: 'request-a' },
      () => repository.exact('version-packaged', externalActor()),
    );

    expect(found).toEqual(expect.objectContaining({ id: 'version-packaged' }));
    const [query] = findFirst.mock.calls[0];
    expect(query.where.tenantId).toBe('tenant-a');
    expect(query.where.documentVersionId).toBe('version-packaged');
    expect(query.where.submission.workRequest.OR).toContainEqual({
      bid: { is: { clientId: 'client-a' } },
    });
  });

  it.each([
    'version-sibling',
    'version-unrelated-document',
    'version-cross-tenant',
  ])('denies a non-packaged exact version (%s)', async (versionId) => {
    const findFirst = finder(null);
    const repository = subject(findFirst);

    const found = await RequestContext.run(
      { tenantId: 'tenant-a', requestId: 'request-a' },
      () => repository.exact(versionId, externalActor()),
    );

    expect(found).toBeNull();
    expect(findFirst.mock.calls[0][0].where.documentVersionId).toBe(versionId);
  });

  it('uses the linked client contact in the immutable package visibility query', async () => {
    const findFirst = finder(null);
    const repository = subject(findFirst);

    await RequestContext.run(
      { tenantId: 'tenant-a', requestId: 'request-a' },
      () => repository.exact('version-packaged', externalActor('client-b')),
    );

    expect(
      findFirst.mock.calls[0][0].where.submission.workRequest.OR,
    ).toContainEqual({ bid: { is: { clientId: 'client-b' } } });
  });
});

import { Readable } from 'node:stream';
import { AppException } from '../common/exceptions/app-exception';
import type { SessionActor } from '../common/security/session.types';
import { DocumentManagementRepository } from './document-management.repository';
import { DocumentManagementService } from './document-management.service';

const version = {
  id: 'version-a',
  owner: 'WORK_REQUEST' as const,
  parentId: 'request-a',
  documentId: 'document-a',
  storageKey: 'tenant-a/request-a/version-a',
  generatedFileName: 'A.pdf',
  uploadedFileName: 'source.pdf',
  mimeType: 'application/pdf',
  fileSizeBytes: 42n,
  versionNumber: 1,
  revisionCode: '01',
  uploadedAt: new Date('2026-01-02T03:04:05.000Z'),
  uploadedByActorId: 'actor-a',
  documentCode: '001',
};

function subject(found = version) {
  const repository = {
    exact: jest.fn().mockResolvedValue(found),
    search: jest.fn().mockResolvedValue([found]),
    timezone: jest.fn().mockResolvedValue('Asia/Dhaka'),
  };
  const storage = {
    openReadStream: jest.fn().mockResolvedValue(Readable.from(['file'])),
  };
  return {
    repository,
    storage,
    service: new DocumentManagementService(
      repository as unknown as DocumentManagementRepository,
      storage,
    ),
  };
}

describe('DocumentManagementService', () => {
  const internalActor = { id: 'internal-a' } as SessionActor;
  const externalActor = { id: 'external-a', clientContact: {} } as SessionActor;

  it('keeps tree and search internal-only through the repository boundary', async () => {
    const { repository, service } = subject();

    await service.tree('A', internalActor);
    await service.search({ q: 'A' }, internalActor);

    expect(repository.search).toHaveBeenCalledTimes(2);
    expect(repository.search).toHaveBeenLastCalledWith('A', internalActor);
  });

  it('streams storage only after exact-version authorization resolves', async () => {
    const { repository, storage, service } = subject();

    await service.download(version.id, externalActor);

    expect(repository.exact).toHaveBeenCalledWith(version.id, externalActor);
    expect(storage.openReadStream).toHaveBeenCalledWith(version.storageKey);
    expect(repository.exact.mock.invocationCallOrder[0]).toBeLessThan(
      storage.openReadStream.mock.invocationCallOrder[0],
    );
  });

  it('does not touch storage when exact-version authorization denies access', async () => {
    const { storage, service } = subject(null);

    await expect(
      service.download('version-denied', externalActor),
    ).rejects.toBeInstanceOf(AppException);

    expect(storage.openReadStream).not.toHaveBeenCalled();
  });
});

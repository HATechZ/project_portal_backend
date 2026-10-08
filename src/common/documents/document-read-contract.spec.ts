import { RequestContext } from '../context/request-context';
import { BidService } from '../../bid/bid.service';
import type { BidRepository } from '../../bid/repositories/bid.repository';
import { ProjectService } from '../../project/project.service';
import type { ProjectRepository } from '../../project/repositories/project.repository';
import { PermissionCode } from '../../generated/prisma/client';

const tenantId = '11111111-1111-4111-8111-111111111111';
const actor = {
  role: {
    rolePermissions: [
      { revokedAt: null, permission: { code: PermissionCode.VIEW_BID } },
      { revokedAt: null, permission: { code: PermissionCode.VIEW_PROJECT } },
    ],
  },
} as never;
const document = {
  id: '22222222-2222-4222-8222-222222222222',
  documentCodeId: '33333333-3333-4333-8333-333333333333',
  documentCodeSnapshot: '100',
  documentNameSnapshot: 'Stowage Plan',
  originalFileName: 'source.pdf',
  versions: [
    {
      id: '44444444-4444-4444-8444-444444444444',
      versionNumber: 2,
      revisionCode: 'A',
      uploadedFileName: 'upload.pdf',
      generatedFileName: 'official.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: BigInt(12),
      uploadedAt: new Date('2026-10-05T00:00:00.000Z'),
      uploadedByActor: { id: 'actor', label: 'Uploader' },
    },
  ],
};

describe('document read contract', () => {
  it('returns a safe Bid document summary and immutable version metadata', async () => {
    const repository = {
      find: jest.fn().mockResolvedValue({ id: 'bid', clientId: 'client' }),
      documents: jest.fn().mockResolvedValue([document]),
      documentVersions: jest.fn().mockResolvedValue(document.versions),
    } as unknown as BidRepository;
    const scope = { assertCanAccess: jest.fn() };
    const service = new BidService(
      repository,
      {} as never,
      {} as never,
      {} as never,
      scope as never,
      {} as never,
    );
    await RequestContext.run({ requestId: 'read', tenantId }, async () => {
      const summaries = await service.documents('bid', actor);
      const versions = await service.documentVersions(
        'bid',
        document.id,
        actor,
      );
      expect(summaries[0]).toEqual(
        expect.objectContaining({
          documentId: document.id,
          owner: { kind: 'BID', id: 'bid' },
          documentCode: {
            id: document.documentCodeId,
            code: '100',
            name: 'Stowage Plan',
          },
          originalFileName: 'source.pdf',
        }),
      );
      expect(summaries[0]).not.toHaveProperty('storageKey');
      expect(versions[0]).toEqual(
        expect.objectContaining({
          documentId: document.id,
          versionId: document.versions[0].id,
          versionNumber: 2,
          uploadedFileName: 'upload.pdf',
          mimeType: 'application/pdf',
          size: 12,
        }),
      );
      expect(versions[0]).not.toHaveProperty('storageKey');
      expect(versions[0]).not.toHaveProperty('checksum');
    });
  });

  it('returns the same public version metadata for Project documents', async () => {
    const repository = {
      find: jest.fn().mockResolvedValue({ id: 'project' }),
      documentVersions: jest.fn().mockResolvedValue(document.versions),
    } as unknown as ProjectRepository;
    const service = new ProjectService(
      repository,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await RequestContext.run({ requestId: 'read', tenantId }, async () => {
      const [version] = await service.documentVersions(
        'project',
        document.id,
        actor,
      );
      expect(version).toEqual(
        expect.objectContaining({
          documentId: document.id,
          versionId: document.versions[0].id,
          versionNumber: 2,
          uploadedFileName: 'upload.pdf',
          mimeType: 'application/pdf',
          size: 12,
        }),
      );
      expect(version).not.toHaveProperty('checksum');
    });
  });

  it('does not read a document belonging to another parent', async () => {
    const repository = {
      find: jest.fn().mockResolvedValue({ id: 'bid', clientId: 'client' }),
      documentVersions: jest.fn().mockResolvedValue(null),
    } as unknown as BidRepository;
    const service = new BidService(
      repository,
      {} as never,
      {} as never,
      {} as never,
      { assertCanAccess: jest.fn() } as never,
      {} as never,
    );
    await expect(
      RequestContext.run({ requestId: 'read', tenantId }, () =>
        service.documentVersions('bid', document.id, actor),
      ),
    ).rejects.toThrow('Bid document was not found.');
  });
});

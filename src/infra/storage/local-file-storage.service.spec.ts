import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { DocumentManagementService } from '../../document-management/document-management.service';
import { LocalFileStorageService } from './local-file-storage.service';

async function content(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

describe('LocalFileStorageService', () => {
  it('keeps a successfully uploaded binary readable by preview and download after a service restart', async () => {
    const root = await mkdtemp(join(tmpdir(), 'project-portal-storage-'));
    const config = {
      get: jest.fn().mockReturnValue(root),
    };
    const key = 'tenants/tenant-a/work-requests/request-a/documents/file.pdf';
    const version = {
      id: 'version-a',
      storageKey: key,
      generatedFileName: 'file.pdf',
      uploadedFileName: 'source.pdf',
      mimeType: 'application/pdf',
    };
    const repository = { exact: jest.fn().mockResolvedValue(version) };

    try {
      const uploadStorage = new LocalFileStorageService(config as never);
      await uploadStorage.put({ storageKey: key, content: Buffer.from('pdf') });

      const runtimeStorage = new LocalFileStorageService(config as never);
      const documents = new DocumentManagementService(
        repository as never,
        runtimeStorage,
      );
      const actor = { id: 'actor-a' } as never;
      const [preview, download] = await Promise.all([
        documents.preview(version.id, actor),
        documents.download(version.id, actor),
      ]);

      await expect(content(preview.body)).resolves.toEqual(Buffer.from('pdf'));
      await expect(content(download.body)).resolves.toEqual(Buffer.from('pdf'));
      expect(repository.exact).toHaveBeenCalledWith(version.id, actor);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

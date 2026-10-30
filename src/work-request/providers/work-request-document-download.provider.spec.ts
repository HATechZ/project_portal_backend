import { Readable } from 'node:stream';
import { inflateRawSync } from 'node:zlib';
import { describe, expect, it, jest } from '@jest/globals';
import { AppException } from '../../common/exceptions/app-exception';
import { WorkRequestDocumentDownloadProvider } from './work-request-document-download.provider';

const actor = { id: 'actor-a' } as never;
const row = (id: string, name = `${id}.pdf`) => ({
  id,
  storageKey: `safe/${id}`,
  originalFileName: name,
  uploadedFileName: name,
  generatedFileName: null,
});

function subject(rows = [row('version-a')]) {
  const reads = { find: jest.fn().mockResolvedValue({ id: 'work-request-a' }) };
  const documents = {
    downloadVersions: jest.fn(
      async (_workRequestId: string, versionIds?: string[]) =>
        versionIds ? rows.filter((value) => versionIds.includes(value.id)) : rows,
    ),
  };
  const storage = {
    openReadStream: jest.fn(async (key: string) => Readable.from([key])),
  };
  return {
    reads,
    documents,
    storage,
    provider: new WorkRequestDocumentDownloadProvider(
      reads as never,
      documents as never,
      storage,
    ),
  };
}

async function files(body: Readable): Promise<Map<string, string>> {
  const chunks: Buffer[] = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  const archive = Buffer.concat(chunks);
  const result = new Map<string, string>();
  let offset = archive.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  while (offset >= 0 && archive.readUInt32LE(offset) === 0x02014b50) {
    const compressedSize = archive.readUInt32LE(offset + 20);
    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const localOffset = archive.readUInt32LE(offset + 42);
    const name = archive.subarray(offset + 46, offset + 46 + nameLength).toString();
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    result.set(
      name,
      inflateRawSync(archive.subarray(start, start + compressedSize)).toString(),
    );
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return result;
}

describe('WorkRequestDocumentDownloadProvider', () => {
  it('streams only selected versions, retaining their contents', async () => {
    const { provider, documents } = subject([row('one'), row('two')]);
    const result = await provider.download('work-request-a', ['two'], actor);
    expect(documents.downloadVersions).toHaveBeenCalledWith('work-request-a', [
      'two',
    ]);
    await expect(files(result.body)).resolves.toEqual(
      new Map([['two.pdf', 'safe/two']]),
    );
  });

  it('downloads all versions for an empty selection and disambiguates duplicate names', async () => {
    const { provider, documents } = subject([
      row('one', 'plan.pdf'),
      row('two', 'plan.pdf'),
    ]);
    const result = await provider.download('work-request-a', [], actor);
    expect(documents.downloadVersions).toHaveBeenCalledWith(
      'work-request-a',
      undefined,
    );
    await expect(files(result.body)).resolves.toEqual(
      new Map([
        ['plan.pdf', 'safe/one'],
        ['plan (2).pdf', 'safe/two'],
      ]),
    );
  });

  it.each(['unrelated same-tenant actor', 'cross-tenant actor'])(
    'denies an %s before querying document versions',
    async () => {
      const { provider, reads, documents } = subject();
      reads.find.mockResolvedValueOnce(null);
      await expect(
        provider.download('work-request-a', undefined, actor),
      ).rejects.toBeInstanceOf(AppException);
      expect(documents.downloadVersions).not.toHaveBeenCalled();
    },
  );

  it('rejects a missing or foreign selected version rather than making a partial ZIP', async () => {
    const { provider, storage } = subject([row('owned')]);
    await expect(
      provider.download('work-request-a', ['owned', 'foreign'], actor),
    ).rejects.toBeInstanceOf(AppException);
    expect(storage.openReadStream).not.toHaveBeenCalled();
  });

  it('maps a missing physical file to the existing unavailable-content error', async () => {
    const { provider, storage } = subject();
    storage.openReadStream.mockRejectedValueOnce(new Error('ENOENT'));
    await expect(
      provider.download('work-request-a', undefined, actor),
    ).rejects.toBeInstanceOf(AppException);
  });
});

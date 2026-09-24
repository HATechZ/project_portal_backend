import { WorkRequestDocumentHistoryProvider } from './work-request-document-history.provider';

describe('WorkRequestDocumentHistoryProvider', () => {
  const version = {
    id: 'v1',
    versionNumber: 1,
    revisionCode: 'A',
    originalFileName: 'plan.pdf',
    generatedFileName: null,
    mimeType: 'application/pdf',
    fileSizeBytes: 1n,
    uploadedAt: new Date('2026-01-01'),
    uploadedByActor: { id: 'actor', label: 'Uploader' },
  };
  it('returns only the requested Work Request documents and supports an empty list', async () => {
    const repository = { documents: jest.fn().mockResolvedValue([]) };
    await expect(
      new WorkRequestDocumentHistoryProvider(repository as never).list(
        'request',
      ),
    ).resolves.toEqual([]);
    expect(repository.documents).toHaveBeenCalledWith('request');
  });
  it('returns historical versions oldest to newest without overwriting metadata', async () => {
    const repository = {
      versions: jest.fn().mockResolvedValue([
        version,
        {
          ...version,
          id: 'v2',
          versionNumber: 2,
          revisionCode: 'B',
          uploadedAt: new Date('2026-01-02'),
        },
      ]),
    };
    const result = await new WorkRequestDocumentHistoryProvider(
      repository as never,
    ).versions('request', 'document');
    expect(result.map((item) => item.versionNumber)).toEqual([1, 2]);
    expect(result[0].originalFileName).toBe('plan.pdf');
  });
  it('rejects a document that is not owned by the requested Work Request', async () => {
    const repository = { versions: jest.fn().mockResolvedValue(null) };
    await expect(
      new WorkRequestDocumentHistoryProvider(repository as never).versions(
        'request',
        'foreign-document',
      ),
    ).rejects.toThrow('Work Request document was not found.');
  });
});

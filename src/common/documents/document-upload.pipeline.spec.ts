import { DocumentUploadPipeline } from './document-upload.pipeline';

const upload = (name = 'final_plan_v7.pdf') => ({
  originalname: name,
  mimetype: 'application/pdf',
  size: 12,
  buffer: Buffer.from('x'),
});
const codes = new Map([
  [
    '10000000-0000-4000-8000-000000000000',
    { code: '100', name: 'Stowage Plan' },
  ],
]);
const input = (uploads = [upload()], documentCodeIds = [...codes.keys()]) => ({
  uploads,
  documentCodeIds,
  codes,
  revisionCode: 'A',
  storagePrefix: 'tenants/t/projects/p/documents',
  generatedFileName: (code: { code: string; name: string }) =>
    `SKM-CRA-CA2-01-${code.code}-A ${code.name}.pdf`,
});

describe('DocumentUploadPipeline', () => {
  it('creates one independent logical document and server-generated Version 1 per file', () => {
    const drafts = DocumentUploadPipeline.prepare(
      input(
        [upload(), upload('detail.pdf')],
        [...codes.keys(), ...codes.keys()],
      ),
    );
    expect(drafts).toHaveLength(2);
    expect(drafts[0].documentId).not.toBe(drafts[1].documentId);
    expect(drafts.map((draft) => draft.versionNumber)).toEqual([1, 1]);
    expect(drafts[0]).toMatchObject({
      originalFileName: 'final_plan_v7.pdf',
      uploadedFileName: 'final_plan_v7.pdf',
      documentName: 'Stowage Plan',
      generatedFileName: 'SKM-CRA-CA2-01-100-A Stowage Plan.pdf',
    });
    expect(drafts[0].storageKey).not.toContain('projectId');
  });
  it('rejects missing or mismatched positional document code mapping', () => {
    expect(() => DocumentUploadPipeline.prepare(input([upload()], []))).toThrow(
      'equally sized',
    );
    expect(() => DocumentUploadPipeline.prepare(input([], []))).toThrow(
      'equally sized',
    );
  });
  it('rejects an invalid document code before storage', () => {
    expect(() =>
      DocumentUploadPipeline.prepare(
        input([upload()], ['20000000-0000-4000-8000-000000000000']),
      ),
    ).toThrow('Document Code');
  });
  it('maps optional per-file metadata by position and normalizes blank values', () => {
    const drafts = DocumentUploadPipeline.prepare({
      ...input(
        [upload(), upload('detail.pdf')],
        [...codes.keys(), ...codes.keys()],
      ),
      descriptions: ['  Main plan  ', ''],
      shipmentNumbers: [' S-001 ', ''],
    });
    expect(drafts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: 'Main plan',
          shipmentNumber: 'S-001',
        }),
        expect.objectContaining({ description: null, shipmentNumber: null }),
      ]),
    );
  });
  it('rejects incomplete optional metadata arrays before storage', () => {
    expect(() =>
      DocumentUploadPipeline.prepare({
        ...input(
          [upload(), upload('detail.pdf')],
          [...codes.keys(), ...codes.keys()],
        ),
        descriptions: ['only one'],
      }),
    ).toThrow('descriptions');
  });
  it('rejects metadata beyond the shared per-item limits', () => {
    expect(() =>
      DocumentUploadPipeline.prepare({
        ...input(),
        descriptions: ['x'.repeat(10001)],
      }),
    ).toThrow('description');
    expect(() =>
      DocumentUploadPipeline.prepare({
        ...input(),
        shipmentNumbers: ['x'.repeat(11)],
      }),
    ).toThrow('shipment number');
  });
  it('compensates stored files when persistence fails', async () => {
    const storage = {
      put: jest.fn(),
      remove: jest.fn().mockRejectedValue(new Error('offline')),
    };
    const cleanup = jest.fn();
    await DocumentUploadPipeline.compensate(storage, ['one'], cleanup);
    expect(storage.remove).toHaveBeenCalledWith('one');
    expect(cleanup).toHaveBeenCalledWith('one', expect.any(Error));
  });
  it('removes already-written binaries when a later storage write fails before metadata persistence', async () => {
    const storage = {
      put: jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('disk unavailable')),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    await expect(
      DocumentUploadPipeline.putAll(storage, [
        { storageKey: 'first', content: Buffer.from('first') },
        { storageKey: 'second', content: Buffer.from('second') },
      ]),
    ).rejects.toThrow('disk unavailable');
    expect(storage.remove).toHaveBeenCalledWith('first');
  });
  it('prepares a new immutable version without changing logical-document metadata', () => {
    const version = DocumentUploadPipeline.prepareVersion({
      upload: upload('SKM-CRA-CA2-01-100-A Stowage Plan.pdf'),
      revisionCode: 'A',
      storagePrefix: 'tenants/t/projects/p/documents/d/versions',
      generatedFileName: () => 'SKM-CRA-CA2-01-100-A Stowage Plan.pdf',
    });
    expect(version).toMatchObject({
      revisionCode: 'A',
      uploadedFileName: 'SKM-CRA-CA2-01-100-A Stowage Plan.pdf',
      generatedFileName: 'SKM-CRA-CA2-01-100-A Stowage Plan.pdf',
    });
    expect(version).not.toHaveProperty('versionNumber');
    expect(version.versionId).toEqual(expect.any(String));
    expect(version.storageKey).toContain('/versions/');
  });
});

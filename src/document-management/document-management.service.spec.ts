import { Readable } from 'node:stream';
import { AppException } from '../common/exceptions/app-exception';
import type { SessionActor } from '../common/security/session.types';
import { DocumentManagementRepository } from './document-management.repository';
import {
  DocumentManagementService,
  type SearchInput,
} from './document-management.service';

const actor = { id: 'internal-a' } as SessionActor;
const at = (day: number) =>
  new Date(`2026-01-${String(day).padStart(2, '0')}T03:04:05.000Z`);
function version(overrides: Record<string, unknown> = {}) {
  return {
    id: 'version-a',
    owner: 'BID' as const,
    parentId: 'bid-a',
    documentId: 'document-a',
    storageKey: 'x',
    originalFileName: 'source.pdf',
    uploadedFileName: 'upload.pdf',
    generatedFileName: 'A.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 42n,
    versionNumber: 1,
    revisionCode: 'A',
    uploadedAt: at(2),
    uploadedByActorId: 'uploader-a',
    documentCode: '001 Project Information',
    documentCodeId: 'code-a',
    workRequestId: null,
    sourceKind: 'BID' as const,
    sourceId: 'bid-a',
    sourceLabel: 'B-001 - Client A - Alpha',
    documentName: 'Project Information',
    ...overrides,
  };
}
function subject(rows = [version()]) {
  const repository = {
    exact: jest.fn().mockResolvedValue(rows[0]),
    search: jest.fn().mockResolvedValue(rows),
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

describe('DocumentManagementService tree contract', () => {
  it('constructs one ordered ROOT → parent → code → date → file hierarchy without duplicate source roots', async () => {
    const rows = [
      version({ id: 'bid-v1', uploadedAt: at(2) }),
      version({
        id: 'wr-bid',
        owner: 'WORK_REQUEST',
        parentId: 'wr-bid',
        documentId: 'wr-doc',
        workRequestId: 'wr-bid',
        uploadedAt: at(2),
      }),
      version({
        id: 'project-v1',
        owner: 'PROJECT',
        parentId: 'project-a',
        documentId: 'project-doc',
        sourceKind: 'PROJECT',
        sourceId: 'project-a',
        sourceLabel: 'P-001 - Client B - Beta',
        documentCode: '011 Action Log',
        documentCodeId: 'code-b',
        uploadedAt: at(4),
      }),
      version({
        id: 'wr-project',
        owner: 'WORK_REQUEST',
        parentId: 'wr-project',
        documentId: 'wr-project-doc',
        workRequestId: 'wr-project',
        sourceKind: 'PROJECT',
        sourceId: 'project-a',
        sourceLabel: 'P-001 - Client B - Beta',
        documentCode: '011 Action Log',
        documentCodeId: 'code-b',
        uploadedAt: at(4),
      }),
    ];
    const { service } = subject(rows);
    const roots = await service.tree({}, actor);
    expect(roots).toEqual([
      expect.objectContaining({ type: 'ROOT', hasChildren: true }),
    ]);
    const parents = await service.tree(
      { parentNodeId: roots[0].nodeId },
      actor,
    );
    expect(parents.map((node) => [node.type, node.label])).toEqual([
      ['BID', 'B-001 - Client A - Alpha'],
      ['PROJECT', 'P-001 - Client B - Beta'],
    ]);
    for (const [parent, expected] of [
      [parents[0], ['bid-v1', 'wr-bid']],
      [parents[1], ['project-v1', 'wr-project']],
    ] as const) {
      const [code] = await service.tree({ parentNodeId: parent.nodeId }, actor);
      const [date] = await service.tree({ parentNodeId: code.nodeId }, actor);
      const files = await service.tree({ parentNodeId: date.nodeId }, actor);
      expect(files.map((node) => node.file?.versionId)).toEqual(expected);
    }
    expect(new Set(parents.map((node) => node.nodeId)).size).toBe(2);
  });

  it('uses only the already authorized projection for nodes and pagination', async () => {
    const { service, repository } = subject([version({ id: 'visible' })]);
    const [root] = await service.tree({}, actor);
    expect(
      await service.tree({ parentNodeId: root.nodeId, limit: 1 }, actor),
    ).toHaveLength(1);
    expect(
      JSON.stringify(await service.tree({ parentNodeId: root.nodeId }, actor)),
    ).not.toContain('hidden');
    expect(repository.search).toHaveBeenCalledWith(undefined, actor);
  });
});

describe('DocumentManagementService search contract', () => {
  const rows = [
    version({
      id: 'newest',
      documentId: 'same',
      uploadedAt: at(5),
      versionNumber: 2,
      revisionCode: 'B',
    }),
    version({
      id: 'older',
      documentId: 'same',
      uploadedAt: at(2),
      versionNumber: 1,
      revisionCode: 'A',
      mimeType: 'image/png',
      uploadedByActorId: 'uploader-b',
    }),
    version({
      id: 'project',
      owner: 'PROJECT',
      parentId: 'project-a',
      documentId: 'project-doc',
      sourceKind: 'PROJECT',
      sourceId: 'project-a',
      sourceLabel: 'P-001 - Client B - Beta',
      documentCode: '011 Action Log',
      documentCodeId: 'code-b',
      workRequestId: 'wr-project',
      uploadedAt: at(4),
      generatedFileName: 'action-log.pdf',
    }),
  ];
  const cases: Array<[string, SearchInput, string[]]> = [
    ['q', { q: 'client b' }, ['project']],
    ['parent kind', { parentKind: 'PROJECT' }, ['project']],
    ['parent id', { parentId: 'bid-a' }, ['newest', 'older']],
    ['work request', { workRequestId: 'wr-project' }, ['project']],
    ['document code', { documentCodeId: 'code-a' }, ['newest', 'older']],
    ['date from', { dateFrom: at(4).toISOString() }, ['newest', 'project']],
    ['date to', { dateTo: at(2).toISOString() }, ['older']],
    ['revision', { revisionCode: 'B' }, ['newest']],
    ['version number', { versionNumber: 1 }, ['older', 'project']],
    ['mime', { mimeType: 'image/png' }, ['older']],
    ['uploader', { uploaderId: 'uploader-b' }, ['older']],
  ];
  it.each(cases)(
    'applies %s to the authorized projection',
    async (_name, input, expected) => {
      const { service } = subject(rows);
      expect(
        (await service.search({ ...input, mode: 'exact' }, actor)).items.map(
          (item) => item.versionId,
        ),
      ).toEqual(expected);
    },
  );
  it('ANDs filters, defaults latest, and preserves exact sort/cursor', async () => {
    const { service } = subject(rows);
    await expect(service.search({}, actor)).rejects.toBeInstanceOf(
      AppException,
    );
    expect(
      (await service.search({ parentId: 'bid-a' }, actor)).items.map(
        (item) => item.versionId,
      ),
    ).toEqual(['newest']);
    const first = await service.search(
      { parentId: 'bid-a', mode: 'exact', limit: 1 },
      actor,
    );
    expect(
      (
        await service.search(
          { parentId: 'bid-a', mode: 'exact', cursor: first.nextCursor },
          actor,
        )
      ).items.map((item) => item.versionId),
    ).toEqual(['older']);
    expect(
      (
        await service.search(
          {
            parentId: 'bid-a',
            revisionCode: 'A',
            mimeType: 'image/png',
            mode: 'exact',
          },
          actor,
        )
      ).items.map((item) => item.versionId),
    ).toEqual(['older']);
  });
});

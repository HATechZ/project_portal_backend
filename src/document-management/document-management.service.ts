import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Readable } from 'node:stream';
import {
  FILE_STORAGE,
  type FileStorage,
} from '../contracts/storage/file-storage.port';
import { AppErrorCode } from '../common/exceptions/app-error-code';
import { AppException } from '../common/exceptions/app-exception';
import type { SessionActor } from '../common/security/session.types';
import {
  DocumentManagementRepository,
  type ExactDocumentVersion,
} from './document-management.repository';

export type SearchInput = {
  q?: string;
  parentKind?: ExactDocumentVersion['owner'];
  parentId?: string;
  workRequestId?: string;
  documentCodeId?: string;
  revisionCode?: string;
  versionNumber?: number;
  mimeType?: string;
  uploaderId?: string;
  dateFrom?: string;
  dateTo?: string;
  mode?: 'latest' | 'exact';
  cursor?: string;
  limit?: number;
  sort?: 'uploadedAt:desc';
};

type FileProjection = {
  versionId: string;
  owner: { kind: ExactDocumentVersion['owner']; id: string };
  sourceParent: {
    kind: NonNullable<ExactDocumentVersion['sourceKind']>;
    id: string;
  } | null;
  workRequestId: string | null;
  documentId: string;
  documentCode: string | null;
  originalFileName: string | null;
  versionNumber: number;
  revisionCode: string;
  uploadedFileName: string | null;
  generatedFileName: string | null;
  mimeType: string;
  size: number;
  uploadedAt: Date;
};

type TreeNode = {
  nodeId: string;
  type: 'ROOT' | 'BID' | 'PROJECT' | 'DOCUMENT_CODE' | 'DATE' | 'FILE';
  label: string;
  parentNodeId?: string;
  hasChildren: boolean;
  itemCount?: number;
  file?: FileProjection;
  sortAt?: number;
  codeSortOrder?: number;
};

@Injectable()
export class DocumentManagementService {
  constructor(
    private readonly documents: DocumentManagementRepository,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  async exact(id: string, actor: SessionActor): Promise<FileProjection> {
    return projection(await this.resolveExact(id, actor));
  }

  async search(input: SearchInput, actor: SessionActor) {
    if (!hasBound(input)) {
      throw badRequest(
        'Search requires a query or bounded parent/code filter.',
      );
    }
    const filtered = this.filter(
      await this.documents.search(undefined, actor),
      input,
    );
    const mode = input.mode ?? 'latest';
    const versions = mode === 'latest' ? latestVersions(filtered) : filtered;
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
    const start = input.cursor ? decodeCursor(input.cursor) : 0;
    const page = versions.slice(start, start + limit);
    return {
      items: page.map(projection),
      nextCursor:
        start + limit < versions.length
          ? encodeCursor(start + limit)
          : undefined,
    };
  }

  async tree(
    input: { parentNodeId?: string; cursor?: string; limit?: number },
    actor: SessionActor,
  ): Promise<TreeNode[]> {
    const [versions, timezone] = await Promise.all([
      this.documents.search(undefined, actor),
      this.documents.timezone(),
    ]);
    const all = treeNodes(versions, timezone);
    const children = all.filter((node) =>
      input.parentNodeId
        ? node.parentNodeId === input.parentNodeId
        : node.type === 'ROOT',
    );
    const start = input.cursor ? decodeCursor(input.cursor) : 0;
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
    return children.slice(start, start + limit);
  }

  async preview(id: string, actor: SessionActor) {
    const file = await this.open(id, actor);
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      throw unavailable();
    }
    return file;
  }

  async download(id: string, actor: SessionActor) {
    return this.open(id, actor);
  }

  private filter(
    versions: ExactDocumentVersion[],
    input: SearchInput,
  ): ExactDocumentVersion[] {
    return versions.filter(
      (value) =>
        (!input.q || matchesQuery(value, input.q)) &&
        (!input.parentKind || value.sourceKind === input.parentKind) &&
        (!input.parentId || value.sourceId === input.parentId) &&
        (!input.workRequestId || value.workRequestId === input.workRequestId) &&
        (!input.documentCodeId ||
          value.documentCodeId === input.documentCodeId) &&
        (!input.revisionCode || value.revisionCode === input.revisionCode) &&
        (!input.versionNumber || value.versionNumber === input.versionNumber) &&
        (!input.mimeType || value.mimeType === input.mimeType) &&
        (!input.uploaderId || value.uploadedByActorId === input.uploaderId) &&
        (!input.dateFrom || value.uploadedAt >= new Date(input.dateFrom)) &&
        (!input.dateTo || value.uploadedAt <= new Date(input.dateTo)),
    );
  }

  private async open(
    id: string,
    actor: SessionActor,
  ): Promise<{
    body: Readable;
    type: string;
    name: string;
  }> {
    // The exact resolver always precedes storage access.
    const version = await this.resolveExact(id, actor);
    try {
      return {
        body: await this.storage.openReadStream(version.storageKey),
        type: version.mimeType,
        name:
          version.generatedFileName ?? version.uploadedFileName ?? 'download',
      };
    } catch {
      throw unavailable();
    }
  }

  private async resolveExact(
    id: string,
    actor: SessionActor,
  ): Promise<ExactDocumentVersion> {
    const version = await this.documents.exact(id, actor);
    if (!version) throw missing();
    return version;
  }
}

function treeNodes(
  versions: ExactDocumentVersion[],
  timezone: string,
): TreeNode[] {
  const nodes = new Map<string, TreeNode>();
  const add = (node: TreeNode) => nodes.set(node.nodeId, node);
  const rootId = nodeId('root');
  if (versions.some((value) => value.sourceKind && value.sourceId)) {
    add({
      nodeId: rootId,
      type: 'ROOT',
      label: 'Documents',
      hasChildren: true,
    });
  }
  for (const value of versions) {
    if (!value.sourceKind || !value.sourceId) continue;
    const rootType = value.sourceKind;
    const codeKey =
      value.documentCodeId ?? value.documentCode ?? 'Unclassified';
    const code =
      [value.documentCode, value.documentName]
        .filter((part): part is string => Boolean(part))
        .join(' ') || 'Unclassified';
    const parentId = nodeId('parent', rootType, value.sourceId);
    const codeId = nodeId('code', parentId, codeKey);
    const date = dateLabel(value.uploadedAt, timezone);
    const dateId = nodeId('date', codeId, date);
    const fileId = nodeId('file', value.id);
    add({
      nodeId: parentId,
      type: rootType,
      label: value.sourceLabel ?? value.sourceId,
      parentNodeId: rootId,
      hasChildren: true,
    });
    add({
      nodeId: codeId,
      type: 'DOCUMENT_CODE',
      label: code,
      parentNodeId: parentId,
      hasChildren: true,
      codeSortOrder: value.documentCodeSortOrder,
    });
    add({
      nodeId: dateId,
      type: 'DATE',
      label: date,
      parentNodeId: codeId,
      hasChildren: true,
      sortAt: value.uploadedAt.getTime(),
    });
    add({
      nodeId: fileId,
      type: 'FILE',
      label: value.generatedFileName ?? value.uploadedFileName ?? value.id,
      parentNodeId: dateId,
      hasChildren: false,
      file: projection(value),
    });
  }
  return [...nodes.values()]
    .sort(treeOrder)
    .map(({ sortAt: _sortAt, codeSortOrder: _codeSortOrder, ...node }) => node);
}

function projection(value: ExactDocumentVersion): FileProjection {
  return {
    versionId: value.id,
    owner: { kind: value.owner, id: value.parentId },
    sourceParent:
      value.sourceKind && value.sourceId
        ? { kind: value.sourceKind, id: value.sourceId }
        : null,
    workRequestId: value.workRequestId,
    documentId: value.documentId,
    documentCode: value.documentCode,
    originalFileName: value.originalFileName,
    versionNumber: value.versionNumber,
    revisionCode: value.revisionCode,
    uploadedFileName: value.uploadedFileName,
    generatedFileName: value.generatedFileName,
    mimeType: value.mimeType,
    size: Number(value.fileSizeBytes),
    uploadedAt: value.uploadedAt,
  };
}
function hasBound(input: SearchInput): boolean {
  return Boolean(
    input.q ||
    input.parentKind ||
    input.parentId ||
    input.workRequestId ||
    input.documentCodeId ||
    input.dateFrom ||
    input.dateTo ||
    input.revisionCode ||
    input.versionNumber !== undefined ||
    input.mimeType ||
    input.uploaderId,
  );
}
function latestVersions(
  versions: ExactDocumentVersion[],
): ExactDocumentVersion[] {
  const latest = new Map<string, ExactDocumentVersion>();
  for (const version of versions) {
    const prior = latest.get(version.documentId);
    if (
      !prior ||
      version.uploadedAt > prior.uploadedAt ||
      (version.uploadedAt.getTime() === prior.uploadedAt.getTime() &&
        version.id > prior.id)
    ) {
      latest.set(version.documentId, version);
    }
  }
  return [...latest.values()].sort(
    (left, right) =>
      right.uploadedAt.getTime() - left.uploadedAt.getTime() ||
      right.id.localeCompare(left.id),
  );
}
function matchesQuery(value: ExactDocumentVersion, query: string): boolean {
  const needle = query.normalize('NFC').toLocaleLowerCase();
  return [
    value.sourceLabel,
    value.documentCode,
    value.documentName,
    value.originalFileName,
    value.uploadedFileName,
    value.generatedFileName,
  ].some((field) =>
    field?.normalize('NFC').toLocaleLowerCase().includes(needle),
  );
}
function dateLabel(value: Date, timezone: string): string {
  const fields = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    fields.find((field) => field.type === type)?.value;
  return `${part('day')}-${part('month')}-${part('year')}`;
}

function treeOrder(left: TreeNode, right: TreeNode): number {
  const ranks: Record<TreeNode['type'], number> = {
    ROOT: 0,
    BID: 1,
    PROJECT: 1,
    DOCUMENT_CODE: 2,
    DATE: 3,
    FILE: 4,
  };
  if (left.parentNodeId !== right.parentNodeId)
    return (left.parentNodeId ?? '').localeCompare(right.parentNodeId ?? '');
  if (ranks[left.type] !== ranks[right.type])
    return ranks[left.type] - ranks[right.type];
  if (left.type === 'DOCUMENT_CODE' && right.type === 'DOCUMENT_CODE')
    return (
      (left.codeSortOrder ?? Number.MAX_SAFE_INTEGER) -
        (right.codeSortOrder ?? Number.MAX_SAFE_INTEGER) ||
      left.label.localeCompare(right.label) ||
      left.nodeId.localeCompare(right.nodeId)
    );
  if (left.type === 'DATE' && right.type === 'DATE')
    return (
      (right.sortAt ?? 0) - (left.sortAt ?? 0) ||
      right.label.localeCompare(left.label)
    );
  if (left.type === 'FILE' && right.type === 'FILE' && left.file && right.file)
    return (
      left.file.uploadedAt.getTime() - right.file.uploadedAt.getTime() ||
      left.file.versionId.localeCompare(right.file.versionId)
    );
  return (
    left.label.localeCompare(right.label) ||
    left.nodeId.localeCompare(right.nodeId)
  );
}
function nodeId(...parts: string[]): string {
  return Buffer.from(parts.join('\u001f')).toString('base64url');
}
function encodeCursor(offset: number): string {
  return Buffer.from(String(offset)).toString('base64url');
}
function decodeCursor(cursor: string): number {
  const value = Number(Buffer.from(cursor, 'base64url').toString());
  if (!Number.isInteger(value) || value < 0)
    throw badRequest('Invalid cursor.');
  return value;
}
function missing(): AppException {
  return new AppException({
    code: AppErrorCode.NotFound,
    status: HttpStatus.NOT_FOUND,
    message: 'Document version was not found.',
  });
}
function unavailable(): AppException {
  return new AppException({
    code: AppErrorCode.Conflict,
    status: HttpStatus.CONFLICT,
    message: 'Document content is unavailable.',
  });
}
function badRequest(message: string): AppException {
  return new AppException({
    code: AppErrorCode.BadRequest,
    status: HttpStatus.BAD_REQUEST,
    message,
  });
}

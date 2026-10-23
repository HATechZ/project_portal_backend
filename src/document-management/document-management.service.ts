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
};

type FileProjection = {
  versionId: string;
  owner: { kind: ExactDocumentVersion['owner']; id: string };
  documentId: string;
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
    if (
      !input.q &&
      !input.parentId &&
      !input.documentCodeId &&
      !input.workRequestId
    ) {
      throw badRequest(
        'Search requires a query or bounded parent/code filter.',
      );
    }
    const filtered = this.filter(
      await this.documents.search(input.q, actor),
      input,
    );
    const mode = input.mode ?? 'latest';
    const versions =
      mode === 'latest'
        ? [...new Map(filtered.map((item) => [item.documentId, item])).values()]
        : filtered;
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
    parentNodeId: string | undefined,
    actor: SessionActor,
  ): Promise<TreeNode[]> {
    const [versions, timezone] = await Promise.all([
      this.documents.search(undefined, actor),
      this.documents.timezone(),
    ]);
    const all = treeNodes(versions, timezone);
    return all.filter((node) =>
      parentNodeId ? node.parentNodeId === parentNodeId : node.type === 'ROOT',
    );
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
  for (const value of versions) {
    if (!value.sourceKind || !value.sourceId) continue;
    const rootType = value.sourceKind;
    const rootId = nodeId('group', rootType);
    const code = value.documentCode ?? 'Unclassified';
    const parentId = nodeId('parent', rootType, value.sourceId);
    const codeId = nodeId('code', parentId, code);
    const date = dateLabel(value.uploadedAt, timezone);
    const dateId = nodeId('date', codeId, date);
    const fileId = nodeId('file', value.id);
    add({
      nodeId: rootId,
      type: 'ROOT',
      label: rootType === 'BID' ? 'Bids / Proposals' : 'Projects Portfolio',
      hasChildren: true,
    });
    add({
      nodeId: parentId,
      type: rootType,
      label: value.sourceId,
      parentNodeId: rootId,
      hasChildren: true,
    });
    add({
      nodeId: codeId,
      type: 'DOCUMENT_CODE',
      label: code,
      parentNodeId: parentId,
      hasChildren: true,
    });
    add({
      nodeId: dateId,
      type: 'DATE',
      label: date,
      parentNodeId: codeId,
      hasChildren: true,
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
  return [...nodes.values()].sort(treeOrder);
}

function projection(value: ExactDocumentVersion): FileProjection {
  return {
    versionId: value.id,
    owner: { kind: value.owner, id: value.parentId },
    documentId: value.documentId,
    versionNumber: value.versionNumber,
    revisionCode: value.revisionCode,
    uploadedFileName: value.uploadedFileName,
    generatedFileName: value.generatedFileName,
    mimeType: value.mimeType,
    size: Number(value.fileSizeBytes),
    uploadedAt: value.uploadedAt,
  };
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
  if (left.type === 'DATE' && right.type === 'DATE')
    return right.label.localeCompare(left.label);
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

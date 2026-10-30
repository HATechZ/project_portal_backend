import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Readable } from 'node:stream';
import {
  FILE_STORAGE,
  type FileStorage,
} from '../../contracts/storage/file-storage.port';
import { streamingZip } from '../../common/documents/streaming-zip';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import type { SessionActor } from '../../common/security/session.types';
import { WorkRequestDocumentRepository } from '../repositories/work-request-document.repository';
import { WorkRequestReadRepository } from '../repositories/work-request-read.repository';

@Injectable()
export class WorkRequestDocumentDownloadProvider {
  constructor(
    private readonly reads: WorkRequestReadRepository,
    private readonly documents: WorkRequestDocumentRepository,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  async download(
    workRequestId: string,
    versionIds: string[] | undefined,
    actor: SessionActor,
  ): Promise<{ body: Readable; name: string }> {
    if (!(await this.reads.find(workRequestId, actor))) throw missing();
    const selected = [...new Set(versionIds ?? [])];
    const versions = await this.documents.downloadVersions(
      workRequestId,
      selected.length ? selected : undefined,
    );
    if (!versions.length || (selected.length && versions.length !== selected.length))
      throw missing();
    const names = new Set<string>();
    try {
      const entries = await Promise.all(
        versions.map(async (version) => ({
          name: uniqueName(
            version.generatedFileName ??
              version.uploadedFileName ??
              version.originalFileName,
            names,
          ),
          body: await this.storage.openReadStream(version.storageKey),
        })),
      );
      return {
        body: streamingZip(entries),
        name: `work-request-${workRequestId}-documents.zip`,
      };
    } catch {
      throw unavailable();
    }
  }
}

function uniqueName(value: string, names: Set<string>): string {
  const safe = value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_') || 'document';
  const dot = safe.lastIndexOf('.');
  let sequence = 1;
  let candidate = safe;
  while (names.has(candidate)) {
    sequence += 1;
    candidate =
      dot > 0
        ? `${safe.slice(0, dot)} (${sequence})${safe.slice(dot)}`
        : `${safe} (${sequence})`;
  }
  names.add(candidate);
  return candidate;
}

function missing(): AppException {
  return new AppException({
    code: AppErrorCode.NotFound,
    status: HttpStatus.NOT_FOUND,
    message: 'Work Request document version was not found.',
  });
}

function unavailable(): AppException {
  return new AppException({
    code: AppErrorCode.Conflict,
    status: HttpStatus.CONFLICT,
    message: 'Document content is unavailable.',
  });
}

import { HttpStatus, Injectable } from '@nestjs/common';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import { WorkRequestDocumentRepository } from '../repositories/work-request-document.repository';

@Injectable()
export class WorkRequestDocumentHistoryProvider {
  constructor(private readonly documents: WorkRequestDocumentRepository) {}
  async list(workRequestId: string) {
    return (await this.documents.documents(workRequestId)).map((document) => ({
      documentId: document.id,
      documentCodeId: document.documentCodeId,
      documentCodeSnapshot: document.documentCodeSnapshot,
      originalFileName: document.originalFileName,
      generatedFileName: document.generatedFileName,
      mimeType: document.mimeType,
      size: Number(document.fileSizeBytes),
      latestVersion: document.versions[0] ?? null,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    }));
  }
  async versions(workRequestId: string, documentId: string) {
    const versions = await this.documents.versions(workRequestId, documentId);
    if (!versions)
      throw new AppException({
        code: AppErrorCode.NotFound,
        status: HttpStatus.NOT_FOUND,
        message: 'Work Request document was not found.',
      });
    return versions.map((version) => ({
      id: version.id,
      versionNumber: version.versionNumber,
      revisionCode: version.revisionCode,
      originalFileName: version.originalFileName,
      generatedFileName: version.generatedFileName,
      mimeType: version.mimeType,
      size: Number(version.fileSizeBytes),
      uploadedAt: version.uploadedAt,
      uploader: {
        id: version.uploadedByActor.id,
        label: version.uploadedByActor.label,
      },
    }));
  }
}

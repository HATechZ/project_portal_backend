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
      owner: { kind: 'WORK_REQUEST' as const, id: workRequestId },
      documentCode: {
        id: document.documentCodeId,
        code: document.documentCodeSnapshot,
        name: document.documentNameSnapshot,
      },
      originalFileName: document.originalFileName,
      latestVersion: document.versions[0]
        ? {
            versionId: document.versions[0].id,
            versionNumber: document.versions[0].versionNumber,
            revisionCode: document.versions[0].revisionCode,
            uploadedFileName:
              document.versions[0].uploadedFileName ??
              document.originalFileName,
            generatedFileName: document.versions[0].generatedFileName ?? '',
            mimeType: document.versions[0].mimeType,
            size: Number(document.versions[0].fileSizeBytes),
            uploadedBy: document.versions[0].uploadedByActor,
            uploadedAt: document.versions[0].uploadedAt,
          }
        : null,
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
      documentId,
      versionId: version.id,
      versionNumber: version.versionNumber,
      revisionCode: version.revisionCode,
      uploadedFileName: version.uploadedFileName ?? '',
      generatedFileName: version.generatedFileName,
      mimeType: version.mimeType,
      size: Number(version.fileSizeBytes),
      uploadedAt: version.uploadedAt,
      uploadedBy: {
        id: version.uploadedByActor.id,
        label: version.uploadedByActor.label,
      },
    }));
  }

  async externalList(workRequestId: string) {
    const published = await this.documents.externalDocuments(workRequestId);
    return published.map(({ documentVersion: version }) => ({
      documentId: version.document.id,
      versionId: version.id,
      versionNumber: version.versionNumber,
      revisionCode: version.revisionCode,
      uploadedFileName: version.uploadedFileName ?? '',
      generatedFileName: version.generatedFileName ?? '',
      mimeType: version.mimeType,
      size: Number(version.fileSizeBytes),
      uploadedAt: version.uploadedAt,
    }));
  }

  async externalVersions(workRequestId: string, documentId: string) {
    const published = await this.documents.externalVersions(workRequestId, documentId);
    if (!published.length)
      throw new AppException({
        code: AppErrorCode.NotFound,
        status: HttpStatus.NOT_FOUND,
        message: 'Work Request document was not found.',
      });
    return published.map(({ documentVersion: version }) => ({
      documentId,
      versionId: version.id,
      versionNumber: version.versionNumber,
      revisionCode: version.revisionCode,
      uploadedFileName: version.uploadedFileName ?? '',
      generatedFileName: version.generatedFileName ?? '',
      mimeType: version.mimeType,
      size: Number(version.fileSizeBytes),
      uploadedAt: version.uploadedAt,
      uploadedBy: null,
    }));
  }
}

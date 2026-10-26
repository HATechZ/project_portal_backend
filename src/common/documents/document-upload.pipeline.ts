import { randomUUID } from 'node:crypto';
import { basename, extname } from 'node:path';
import { HttpStatus } from '@nestjs/common';
import { AppErrorCode } from '../exceptions/app-error-code';
import { AppException } from '../exceptions/app-exception';
import type { FileStorage } from '../../contracts/storage/file-storage.port';

export type DocumentUpload = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

export type NewDocumentDraft = {
  documentId: string;
  versionId: string;
  documentCodeId: string;
  documentCode: string;
  documentName: string;
  originalFileName: string;
  description: string | null;
  shipmentNumber: string | null;
  uploadedFileName: string;
  versionNumber: 1;
  revisionCode: string;
  generatedFileName: string;
  storageKey: string;
  mimeType: string;
  fileSizeBytes: bigint;
  content: Buffer;
};
export type NewDocumentVersionDraft = Omit<
  NewDocumentDraft,
  | 'documentId'
  | 'documentCodeId'
  | 'documentCode'
  | 'documentName'
  | 'originalFileName'
  | 'description'
  | 'shipmentNumber'
  | 'versionNumber'
>;

/** Shared Phase 1/2 boundary for new logical-document ingestion. */
export class DocumentUploadPipeline {
  static prepareVersion(input: {
    upload: DocumentUpload;
    storagePrefix: string;
    revisionCode: string;
    generatedFileName: (uploaded: string) => string;
  }): NewDocumentVersionDraft {
    const uploadedFileName = safeName(input.upload.originalname);
    assertAllowed(uploadedFileName, input.upload.mimetype);
    if (input.upload.size < 1) throw bad('Uploaded file is invalid.');
    const generatedFileName = input.generatedFileName(uploadedFileName);
    if (!generatedFileName || generatedFileName.length > 260)
      throw bad('Generated filename is invalid.');
    return {
      versionId: randomUUID(),
      uploadedFileName,
      revisionCode: input.revisionCode,
      generatedFileName,
      storageKey: `${input.storagePrefix}/${randomUUID()}${extname(uploadedFileName).toLowerCase()}`,
      mimeType: input.upload.mimetype,
      fileSizeBytes: BigInt(input.upload.size),
      content: input.upload.buffer,
    };
  }
  static prepare(input: {
    uploads: DocumentUpload[];
    documentCodeIds: string[];
    descriptions?: string[];
    shipmentNumbers?: string[];
    storagePrefix: string;
    revisionCode: string;
    codes: Map<string, { code: string; name: string }>;
    generatedFileName: (
      code: { code: string; name: string },
      uploaded: string,
    ) => string;
    allowEmpty?: boolean;
  }): NewDocumentDraft[] {
    if (
      (!input.allowEmpty && !input.uploads.length) ||
      input.uploads.length !== input.documentCodeIds.length
    )
      throw bad(
        'files and documentCodeIds must be equally sized non-empty arrays.',
      );
    if (
      (input.descriptions !== undefined &&
        input.descriptions.length !== input.uploads.length) ||
      (input.shipmentNumbers !== undefined &&
        input.shipmentNumbers.length !== input.uploads.length)
    )
      throw bad(
        'files, descriptions, and shipmentNumbers must be equally sized when metadata is supplied.',
      );
    if (!input.uploads.length) return [];
    return input.uploads.map((upload, index) => {
      const code = input.codes.get(input.documentCodeIds[index]);
      if (!code)
        throw notFound('A Document Code was not found or is inactive.');
      const uploadedFileName = safeName(upload.originalname);
      assertAllowed(uploadedFileName, upload.mimetype);
      if (upload.size < 1) throw bad('Uploaded file is invalid.');
      const generatedFileName = input.generatedFileName(code, uploadedFileName);
      if (!generatedFileName || generatedFileName.length > 260)
        throw bad('Generated filename is invalid.');
      return {
        documentId: randomUUID(),
        versionId: randomUUID(),
        documentCodeId: input.documentCodeIds[index],
        documentCode: code.code,
        documentName: code.name,
        originalFileName: uploadedFileName,
        description: normalizeMetadata(input.descriptions?.[index]),
        shipmentNumber: normalizeMetadata(input.shipmentNumbers?.[index]),
        uploadedFileName,
        versionNumber: 1,
        revisionCode: input.revisionCode,
        generatedFileName,
        storageKey: `${input.storagePrefix}/${randomUUID()}${extname(uploadedFileName).toLowerCase()}`,
        mimeType: upload.mimetype,
        fileSizeBytes: BigInt(upload.size),
        content: upload.buffer,
      };
    });
  }

  static async putAll(
    storage: FileStorage,
    drafts: Array<Pick<NewDocumentDraft, 'storageKey' | 'content'>>,
  ): Promise<string[]> {
    const stored: string[] = [];
    for (const draft of drafts) {
      await storage.put({
        storageKey: draft.storageKey,
        content: draft.content,
      });
      stored.push(draft.storageKey);
    }
    return stored;
  }

  static async compensate(
    storage: FileStorage,
    keys: string[],
    enqueue: (key: string, error: Error) => Promise<void>,
  ): Promise<void> {
    for (const key of keys)
      try {
        await storage.remove(key);
      } catch (error) {
        await enqueue(
          key,
          error instanceof Error ? error : new Error(String(error)),
        );
      }
  }
}

const MIME: Readonly<Record<string, readonly string[]>> = {
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  '.ppt': ['application/vnd.ms-powerpoint'],
  '.pptx': [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  '.csv': ['text/csv', 'application/csv'],
  '.txt': ['text/plain'],
  '.dwg': ['application/acad', 'application/x-acad', 'image/vnd.dwg'],
  '.dxf': ['application/dxf', 'image/vnd.dxf'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.zip': ['application/zip', 'application/x-zip-compressed'],
};
function safeName(value: string) {
  const name = basename(value).normalize('NFC').trim();
  if (!name || name.length > 260) throw bad('Uploaded filename is invalid.');
  return name;
}
function normalizeMetadata(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
function assertAllowed(name: string, mimetype: string) {
  if (!MIME[extname(name).toLowerCase()]?.includes(mimetype.toLowerCase()))
    throw bad('Uploaded file type does not match the approved allowlist.');
}
function bad(message: string) {
  return new AppException({
    code: AppErrorCode.BadRequest,
    status: HttpStatus.BAD_REQUEST,
    message,
  });
}
function notFound(message: string) {
  return new AppException({
    code: AppErrorCode.NotFound,
    status: HttpStatus.NOT_FOUND,
    message,
  });
}

/* eslint-disable @typescript-eslint/unbound-method -- Nest metadata is read from prototype methods. */
import { PATH_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, jest } from '@jest/globals';
import { PassThrough, Readable } from 'node:stream';
import { PermissionCode } from '../generated/prisma/client';
import { FINAL_PERMISSIONS_KEY } from '../common/security/final-permissions.decorator';
import { WorkRequestService } from './work-request.service';
import { WorkRequestDocumentController } from './work-request-document.controller';

describe('WorkRequestDocumentController download contract', () => {
  const service = {
    downloadDocuments: jest.fn().mockResolvedValue({
      body: Readable.from(['zip']),
      name: 'work-request-a-documents.zip',
    }),
  };
  const controller = new WorkRequestDocumentController(
    service as unknown as WorkRequestService,
  );

  it('publishes the Work Request ZIP route with VIEW_DOCUMENT and streams its attachment', async () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, WorkRequestDocumentController),
    ).toBe('work-requests/:id/documents');
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        WorkRequestDocumentController.prototype.download,
      ),
    ).toBe('download');
    expect(
      Reflect.getMetadata(
        FINAL_PERMISSIONS_KEY,
        WorkRequestDocumentController.prototype.download,
      ),
    ).toEqual([PermissionCode.VIEW_DOCUMENT]);
    const response = new PassThrough() as PassThrough & {
      type: jest.Mock;
      attachment: jest.Mock;
    };
    response.type = jest.fn().mockReturnValue(response);
    response.attachment = jest.fn().mockReturnValue(response);
    await controller.download(
      'work-request-a',
      { documentVersionIds: ['version-a'] },
      response as never,
      { id: 'actor-a' } as never,
    );
    expect(service.downloadDocuments).toHaveBeenCalledWith(
      'work-request-a',
      ['version-a'],
      { id: 'actor-a' },
    );
    expect(response.type).toHaveBeenCalledWith('application/zip');
    expect(response.attachment).toHaveBeenCalledWith(
      'work-request-a-documents.zip',
    );
  });

  it('publishes the upload-authorized document-code selector without an administration permission', () => {
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        WorkRequestDocumentController.prototype.availableDocumentCodes,
      ),
    ).toBe('available-document-codes');
    expect(
      Reflect.getMetadata(
        FINAL_PERMISSIONS_KEY,
        WorkRequestDocumentController.prototype.availableDocumentCodes,
      ),
    ).toEqual([PermissionCode.UPLOAD_DOCUMENT]);
  });
});

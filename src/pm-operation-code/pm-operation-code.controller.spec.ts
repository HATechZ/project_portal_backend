/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method */
import { RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { FINAL_PERMISSIONS_KEY } from '../common/security/final-permissions.decorator';
import { FinalPermissionsGuard } from '../common/security/final-permissions.guard';
import { PermissionCode } from '../generated/prisma/client';
import { PmOperationDocumentCodeController } from './pm-operation-code.controller';

describe('PmOperationDocumentCodeController', () => {
  it('declares the PM & Operation route, authorization and lifecycle without delete', () => {
    const prototype = PmOperationDocumentCodeController.prototype;
    const routes = Object.getOwnPropertyNames(prototype)
      .filter((name) => name !== 'constructor')
      .map((name) => [
        Reflect.getMetadata(METHOD_METADATA, prototype[name]),
        Reflect.getMetadata(PATH_METADATA, prototype[name]) ?? '/',
      ]);

    expect(
      Reflect.getMetadata(PATH_METADATA, PmOperationDocumentCodeController),
    ).toBe('project-management-operation-document-codes');
    expect(
      Reflect.getMetadata(GUARDS_METADATA, PmOperationDocumentCodeController),
    ).toContain(FinalPermissionsGuard);
    expect(
      Reflect.getMetadata(FINAL_PERMISSIONS_KEY, prototype.reactivate),
    ).toEqual([PermissionCode.REACTIVATE_DOCUMENT_CODE]);
    expect(routes).toEqual([
      [RequestMethod.GET, '/'],
      [RequestMethod.GET, 'deactivated'],
      [RequestMethod.GET, ':id'],
      [RequestMethod.POST, '/'],
      [RequestMethod.PATCH, ':id'],
      [RequestMethod.PATCH, ':id/deactivate'],
      [RequestMethod.PATCH, ':id/reactivate'],
    ]);
    expect(Object.getOwnPropertyNames(prototype)).not.toContain('delete');
  });
});

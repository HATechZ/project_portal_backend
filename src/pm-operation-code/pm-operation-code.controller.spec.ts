/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
import { RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { PermissionsGuard } from '../common/security/permissions.guard';
import { PERMISSIONS_KEY } from '../common/security/permissions.decorator';
import { WorkflowActionCode } from '../generated/prisma/client';
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
      Reflect.getMetadata(PERMISSIONS_KEY, PmOperationDocumentCodeController),
    ).toEqual([WorkflowActionCode.MANAGE_GENERAL_DOCUMENT_CODES]);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, PmOperationDocumentCodeController),
    ).toContain(PermissionsGuard);
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

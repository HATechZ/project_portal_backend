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
import { rolePermissionCodes } from '../../prisma/seed/data/permissions.data';
import { MarketingDocumentCodeController } from './marketing-document-code.controller';

describe('MarketingDocumentCodeController', () => {
  it('declares the dedicated permission and deactivated-list lifecycle without delete', () => {
    const prototype = MarketingDocumentCodeController.prototype;
    const routes = Object.getOwnPropertyNames(prototype)
      .filter((name) => name !== 'constructor')
      .map((name) => [
        Reflect.getMetadata(METHOD_METADATA, prototype[name]),
        Reflect.getMetadata(PATH_METADATA, prototype[name]) ?? '/',
      ]);

    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, MarketingDocumentCodeController),
    ).toEqual([WorkflowActionCode.MANAGE_GENERAL_DOCUMENT_CODES]);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, MarketingDocumentCodeController),
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

  it('provisions the permission only to approved system roles', () => {
    const action = WorkflowActionCode.MANAGE_GENERAL_DOCUMENT_CODES;
    expect(rolePermissionCodes.system_admin).toContain(action);
    expect(rolePermissionCodes.division_head).toContain(action);
    expect(rolePermissionCodes.division_lead).toContain(action);
    expect(rolePermissionCodes.division_member).not.toContain(action);
    expect(rolePermissionCodes.tms_manager).not.toContain(action);
  });
});

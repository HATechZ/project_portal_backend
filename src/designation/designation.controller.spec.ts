/* eslint-disable @typescript-eslint/unbound-method */
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { FINAL_PERMISSIONS_KEY } from '../common/security/final-permissions.decorator';
import { FinalPermissionsGuard } from '../common/security/final-permissions.guard';
import { PermissionCode } from '../generated/prisma/client';
import { DesignationController } from './designation.controller';

describe('DesignationController authorization contract', () => {
  it('uses explicit final permissions, not a role identity', () => {
    const prototype = DesignationController.prototype;
    expect(
      Reflect.getMetadata(GUARDS_METADATA, DesignationController),
    ).toContain(FinalPermissionsGuard);
    expect(
      Reflect.getMetadata(FINAL_PERMISSIONS_KEY, prototype.findAll),
    ).toEqual([PermissionCode.VIEW_DESIGNATIONS]);
    expect(
      Reflect.getMetadata(FINAL_PERMISSIONS_KEY, prototype.create),
    ).toEqual([PermissionCode.CREATE_DESIGNATION]);
    expect(
      Reflect.getMetadata(FINAL_PERMISSIONS_KEY, prototype.update),
    ).toEqual([PermissionCode.UPDATE_DESIGNATION]);
    expect(
      Reflect.getMetadata(FINAL_PERMISSIONS_KEY, prototype.delete),
    ).toEqual([PermissionCode.DELETE_DESIGNATION]);
  });
});

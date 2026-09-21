/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method */
import { RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { rolePermissionCodes } from '../../prisma/seed/data/permissions.data';
import { PermissionsGuard } from '../common/security/permissions.guard';
import { PERMISSIONS_KEY } from '../common/security/permissions.decorator';
import { WorkflowActionCode } from '../generated/prisma/client';
import { DesignationController } from './designation.controller';

describe('DesignationController authorization contract', () => {
  it('allows authenticated reads without a permission and requires MANAGE_DESIGNATIONS only for mutations', () => {
    const prototype = DesignationController.prototype;
    expect(
      Reflect.getMetadata(GUARDS_METADATA, DesignationController),
    ).toContain(PermissionsGuard);
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, prototype.findAll),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, prototype.findOne),
    ).toBeUndefined();
    for (const method of ['create', 'update', 'delete'] as const)
      expect(Reflect.getMetadata(PERMISSIONS_KEY, prototype[method])).toEqual([
        WorkflowActionCode.MANAGE_DESIGNATIONS,
      ]);
    expect(
      [
        prototype.findAll,
        prototype.findOne,
        prototype.create,
        prototype.update,
        prototype.delete,
      ].map((method) => [
        Reflect.getMetadata(METHOD_METADATA, method),
        Reflect.getMetadata(PATH_METADATA, method) ?? '/',
      ]),
    ).toEqual([
      [RequestMethod.GET, '/'],
      [RequestMethod.GET, ':id'],
      [RequestMethod.POST, '/'],
      [RequestMethod.PATCH, ':id'],
      [RequestMethod.DELETE, ':id'],
    ]);
  });

  it('provisions mutations only to system_admin and division_head', () => {
    const action = WorkflowActionCode.MANAGE_DESIGNATIONS;
    expect(rolePermissionCodes.system_admin).toContain(action);
    expect(rolePermissionCodes.division_head).toContain(action);
    expect(rolePermissionCodes.division_lead).not.toContain(action);
    expect(rolePermissionCodes.team_lead).not.toContain(action);
    expect(rolePermissionCodes.tms_manager).not.toContain(action);
  });
});

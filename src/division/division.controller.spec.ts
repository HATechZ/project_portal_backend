import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { AccessTokenGuard } from '../common/security/access-token.guard';
import { AuthenticationGuard } from '../common/security/authentication.guard';
import { ObjectScopeGuard } from '../common/security/object-scope.guard';
import { PermissionsGuard } from '../common/security/permissions.guard';
import { SystemAdminGuard } from '../common/security/system-admin.guard';
import { PERMISSIONS_KEY } from '../common/security/permissions.decorator';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { WorkflowActionCode } from '../generated/prisma/client';
import { DivisionController } from './division.controller';

describe('DivisionController', () => {
  it('declares ADD_DIVISION authorization at the controller boundary', () => {
    const reflector = new Reflector();
    const permissions = reflector.get<WorkflowActionCode[]>(
      PERMISSIONS_KEY,
      DivisionController,
    );

    expect(permissions).toEqual([WorkflowActionCode.ADD_DIVISION]);
  });

  it('uses the established authenticated system-admin guard chain', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      DivisionController,
    ) as unknown[];

    expect(guards).toEqual([
      AccessTokenGuard,
      TenantContextGuard,
      AuthenticationGuard,
      ObjectScopeGuard,
      SystemAdminGuard,
      PermissionsGuard,
    ]);
  });
});

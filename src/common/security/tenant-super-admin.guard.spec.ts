import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ActorRoleCode } from '../../generated/prisma/client';
import { TenantSuperAdminGuard } from './tenant-super-admin.guard';
import { AppException } from '../exceptions/app-exception';

function contextFor(roleCode?: ActorRoleCode): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () =>
        roleCode
          ? { actor: { role: { systemRole: { systemCode: roleCode } } } }
          : {},
    }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function guardAllowing(allowed: ActorRoleCode[] | undefined) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(allowed),
  } as unknown as Reflector;
  return new TenantSuperAdminGuard(reflector);
}

describe('TenantSuperAdminGuard', () => {
  describe('without the opt-in decorator (every pre-existing route)', () => {
    it('admits tenant_super_admin', () => {
      expect(
        guardAllowing(undefined).canActivate(
          contextFor(ActorRoleCode.tenant_super_admin),
        ),
      ).toBe(true);
    });

    it('denies every other role, unchanged from before', () => {
      for (const role of [
        ActorRoleCode.division_head,
        ActorRoleCode.division_lead,
        ActorRoleCode.team_lead,
        ActorRoleCode.client_owner,
      ]) {
        expect(() =>
          guardAllowing(undefined).canActivate(contextFor(role)),
        ).toThrow(AppException);
      }
    });

    it('denies an unauthenticated request', () => {
      expect(() => guardAllowing(undefined).canActivate(contextFor())).toThrow(
        AppException,
      );
    });
  });

  describe('with AllowActorRoles(division_head)', () => {
    const allowed = [ActorRoleCode.division_head];

    it('admits the listed role', () => {
      expect(
        guardAllowing(allowed).canActivate(
          contextFor(ActorRoleCode.division_head),
        ),
      ).toBe(true);
    });

    it('still admits tenant_super_admin', () => {
      expect(
        guardAllowing(allowed).canActivate(
          contextFor(ActorRoleCode.tenant_super_admin),
        ),
      ).toBe(true);
    });

    it('does not admit a role that was not listed', () => {
      expect(() =>
        guardAllowing(allowed).canActivate(
          contextFor(ActorRoleCode.division_lead),
        ),
      ).toThrow(AppException);
    });
  });
});

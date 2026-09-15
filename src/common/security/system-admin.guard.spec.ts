import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ActorRoleCode } from '../../generated/prisma/client';
import { SystemAdminGuard } from './system-admin.guard';

function contextFor(roleCode?: ActorRoleCode): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () =>
        roleCode ? { actor: { role: { code: roleCode } } } : {},
    }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function guardAllowing(allowed: ActorRoleCode[] | undefined) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(allowed),
  } as unknown as Reflector;
  return new SystemAdminGuard(reflector);
}

describe('SystemAdminGuard', () => {
  describe('without the opt-in decorator (every pre-existing route)', () => {
    it('admits system_admin', () => {
      expect(
        guardAllowing(undefined).canActivate(
          contextFor(ActorRoleCode.system_admin),
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
        ).toThrow(ForbiddenException);
      }
    });

    it('denies an unauthenticated request', () => {
      expect(() => guardAllowing(undefined).canActivate(contextFor())).toThrow(
        ForbiddenException,
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

    it('still admits system_admin', () => {
      expect(
        guardAllowing(allowed).canActivate(
          contextFor(ActorRoleCode.system_admin),
        ),
      ).toBe(true);
    });

    it('does not admit a role that was not listed', () => {
      expect(() =>
        guardAllowing(allowed).canActivate(
          contextFor(ActorRoleCode.division_lead),
        ),
      ).toThrow(ForbiddenException);
    });
  });
});

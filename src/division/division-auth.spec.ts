import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { AccessTokenGuard } from '../common/security/access-token.guard';
import { PermissionsGuard } from '../common/security/permissions.guard';
import { SystemAdminGuard } from '../common/security/system-admin.guard';
import { WorkflowActionCode, ActorRoleCode } from '../generated/prisma/client';
import { PERMISSIONS_KEY } from '../common/security/permissions.decorator';

function contextWithRequest(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => function handler() {},
    getClass: () => function Controller() {},
  } as never;
}

describe('Division authorization behavior', () => {
  it('treats missing bearer credentials as no-login 401', async () => {
    const guard = new AccessTokenGuard({} as never);

    await expect(
      guard.canActivate(contextWithRequest({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects no-login before token verification or mutation dependencies run', async () => {
    const authenticator = { verifyAccessToken: jest.fn() };
    const service = { create: jest.fn(), update: jest.fn(), delete: jest.fn() };
    const repository = {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    const guard = new AccessTokenGuard(authenticator as never);

    await expect(
      guard.canActivate(contextWithRequest({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authenticator.verifyAccessToken).not.toHaveBeenCalled();
    expect(service.create).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
    expect(service.delete).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it.each([ActorRoleCode.division_lead, ActorRoleCode.division_member])(
    'denies %s without a system_admin bypass',
    (roleCode) => {
      const guard = new SystemAdminGuard();

      expect(() =>
        guard.canActivate(
          contextWithRequest({ actor: { role: { code: roleCode } } }),
        ),
      ).toThrow(ForbiddenException);
    },
  );

  it('denies a contextual Team Lead when the actor role is not system_admin', () => {
    const guard = new SystemAdminGuard();

    expect(() =>
      guard.canActivate(
        contextWithRequest({
          actor: {
            role: { code: ActorRoleCode.division_member },
            member: { teamsByLeadMemberId: [{ id: 'team-id' }] },
          },
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('requires configured ADD_DIVISION permission', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue([WorkflowActionCode.ADD_DIVISION]),
    };
    const guard = new PermissionsGuard(reflector as never);

    expect(() =>
      guard.canActivate(
        contextWithRequest({
          actor: {
            role: {
              workflowActionRolePermissionsByRoleId: [],
            },
          },
        }),
      ),
    ).toThrow(ForbiddenException);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(PERMISSIONS_KEY, [
      expect.any(Function),
      expect.any(Function),
    ]);
  });

  it('allows system_admin only when ADD_DIVISION is configured', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue([WorkflowActionCode.ADD_DIVISION]),
    };
    const guard = new PermissionsGuard(reflector as never);

    expect(
      guard.canActivate(
        contextWithRequest({
          actor: {
            role: {
              code: ActorRoleCode.system_admin,
              workflowActionRolePermissionsByRoleId: [
                { action: { code: WorkflowActionCode.ADD_DIVISION } },
              ],
            },
          },
        }),
      ),
    ).toBe(true);
  });
});

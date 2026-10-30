import { PermissionCode } from '../../generated/prisma/client';
import { FinalPermissionsGuard } from './final-permissions.guard';

const contextFor = (
  codes: PermissionCode[],
  customScope:
    | 'client'
    | 'client_contact'
    | 'company'
    | 'division'
    | 'team'
    | 'member'
    | null = null,
  compatibleScopes: (
    | 'client'
    | 'client_contact'
    | 'company'
    | 'division'
    | 'team'
    | 'member'
  )[] = [],
  revoked = false,
) =>
  ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        actor: {
          isActive: true,
          role: {
            isActive: true,
            customScope,
            rolePermissions: codes.map((code) => ({
              revokedAt: revoked ? new Date() : null,
              permission: {
                code,
                scopeCompatibilities: compatibleScopes.map((scope) => ({
                  scope,
                })),
              },
            })),
          },
        },
      }),
    }),
  }) as never;

describe('FinalPermissionsGuard', () => {
  it('allows only explicit final grants and has no role-name bypass', async () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue([PermissionCode.VIEW_MEMBERS]),
    };
    const guard = new FinalPermissionsGuard(reflector as never);
    await expect(
      guard.canActivate(contextFor([PermissionCode.VIEW_MEMBERS])),
    ).resolves.toBe(true);
    await expect(guard.canActivate(contextFor([]))).rejects.toThrow(
      'Missing required explicit permission',
    );
  });

  it('does nothing when an endpoint declares no final permission', async () => {
    const guard = new FinalPermissionsGuard({
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as never);
    await expect(guard.canActivate(contextFor([]))).resolves.toBe(true);
  });

  it('runs feature-owned resource and state checks after the grant check', async () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValueOnce([PermissionCode.VIEW_MEMBERS])
        .mockReturnValueOnce([
          {
            kind: 'resource',
            reason: 'record is unavailable',
            validate: () => false,
          },
        ]),
    };
    const guard = new FinalPermissionsGuard(reflector as never);
    await expect(
      guard.canActivate(contextFor([PermissionCode.VIEW_MEMBERS])),
    ).rejects.toThrow('resource condition');
  });

  it('enforces client and client_contact compatibility from persisted permission metadata', async () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue([PermissionCode.VIEW_DOCUMENT]),
    };
    const guard = new FinalPermissionsGuard(reflector as never);

    await expect(
      guard.canActivate(
        contextFor([PermissionCode.VIEW_DOCUMENT], 'client', [
          'client',
          'client_contact',
        ]),
      ),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(
        contextFor([PermissionCode.VIEW_DOCUMENT], 'client_contact', [
          'client',
        ]),
      ),
    ).rejects.toThrow('Missing required explicit permission');
  });

  it('does not give tenant_super_admin or a retired role label an implicit bypass', async () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue([PermissionCode.VIEW_MEMBERS]),
    };
    const context = contextFor([]) as {
      switchToHttp: () => {
        getRequest: () => { actor: { role: Record<string, unknown> } };
      };
    };
    context.switchToHttp().getRequest().actor.role.systemRole = {
      systemCode: 'tenant_super_admin',
    };
    context.switchToHttp().getRequest().actor.role.customCode = 'division_head';
    await expect(
      new FinalPermissionsGuard(reflector as never).canActivate(
        context as never,
      ),
    ).rejects.toThrow('Missing required explicit permission');
  });

  it('allows an active division-role CREATE_BID grant only when scope-compatible', async () => {
    const guard = new FinalPermissionsGuard({
      getAllAndOverride: jest.fn().mockReturnValue([PermissionCode.CREATE_BID]),
    } as never);

    await expect(
      guard.canActivate(
        contextFor([PermissionCode.CREATE_BID], 'division', ['division']),
      ),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(contextFor([], 'division', ['division'])),
    ).rejects.toThrow('Missing required explicit permission');
    await expect(
      guard.canActivate(
        contextFor([PermissionCode.CREATE_BID], 'division', ['company']),
      ),
    ).rejects.toThrow('Missing required explicit permission');
    await expect(
      guard.canActivate(
        contextFor([PermissionCode.CREATE_BID], 'division', ['division'], true),
      ),
    ).rejects.toThrow('Missing required explicit permission');
  });

  it.each([
    PermissionCode.VIEW_BID,
    PermissionCode.CREATE_BID,
    PermissionCode.VIEW_PROJECT,
    PermissionCode.CREATE_PROJECT,
    PermissionCode.VIEW_WORK_REQUEST,
    PermissionCode.CREATE_WORK_REQUEST,
    PermissionCode.ASSIGN_WORK_REQUEST_DIVISION,
    PermissionCode.VIEW_DOCUMENT,
  ])('allows explicit compatible company-scope %s without a role-name bypass', async (permission) => {
    const guard = new FinalPermissionsGuard({
      getAllAndOverride: jest.fn().mockReturnValue([permission]),
    } as never);
    await expect(
      guard.canActivate(contextFor([permission], 'company', ['company'])),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(contextFor([], 'company', ['company'])),
    ).rejects.toThrow('Missing required explicit permission');
  });
});

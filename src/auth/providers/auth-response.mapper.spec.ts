import { PermissionCode } from '../../generated/prisma/client';
import { toAuthUserResponse } from './auth-response.mapper';

describe('toAuthUserResponse', () => {
  it('projects explicit final permissions and compatible role scopes, not workflow-action grants', () => {
    const user = {
      id: 'user-id',
      fullName: 'Client Contact',
      email: 'contact@example.com',
      country: null,
      phone: null,
      avatarUrl: null,
      userRolesByUserId: [
        {
          role: {
            isActive: true,
            customCode: 'Client reviewer',
            customScope: 'client_contact',
            systemRole: null,
            rolePermissions: [
              {
                revokedAt: null,
                permission: { code: PermissionCode.VIEW_DOCUMENT },
              },
              {
                revokedAt: null,
                permission: { code: PermissionCode.REQUEST_REVISION },
              },
            ],
          },
        },
      ],
    } as never;
    const actor = {
      role: {
        isActive: true,
        customCode: 'Client reviewer',
        customScope: 'client_contact',
        systemRole: null,
        rolePermissions: [
          {
            revokedAt: null,
            permission: {
              code: PermissionCode.VIEW_DOCUMENT,
              scopeCompatibilities: [{ scope: 'client_contact' }],
            },
          },
          {
            revokedAt: null,
            permission: {
              code: PermissionCode.REQUEST_REVISION,
              scopeCompatibilities: [{ scope: 'client_contact' }],
            },
          },
        ],
      },
    } as never;
    const response = toAuthUserResponse(user, actor);

    expect(response).toMatchObject({
      roles: ['Client reviewer'],
      roleScopes: ['client_contact'],
      permissions: [
        PermissionCode.REQUEST_REVISION,
        PermissionCode.VIEW_DOCUMENT,
      ],
    });
  });

  it('projects the active actor role only, matching request authorization', () => {
    const user = {
      id: 'user-id',
      fullName: 'Multi-role user',
      email: 'user@example.com',
      country: null,
      phone: null,
      avatarUrl: null,
      userRolesByUserId: [
        {
          role: {
            isActive: true,
            customCode: 'coordinator',
            customScope: 'division',
            systemRole: null,
            rolePermissions: [
              {
                revokedAt: null,
                permission: { code: PermissionCode.CREATE_BID },
              },
            ],
          },
        },
      ],
    } as never;
    const activeStaffActor = {
      role: {
        isActive: true,
        customCode: 'staff',
        customScope: 'member',
        systemRole: null,
        rolePermissions: [
          {
            revokedAt: null,
            permission: {
              code: PermissionCode.VIEW_BID,
              scopeCompatibilities: [{ scope: 'member' }],
            },
          },
          {
            revokedAt: null,
            permission: {
              code: PermissionCode.CREATE_BID,
              scopeCompatibilities: [{ scope: 'division' }],
            },
          },
        ],
      },
    } as never;

    expect(toAuthUserResponse(user, activeStaffActor)).toMatchObject({
      roles: ['staff'],
      roleScopes: ['member'],
      permissions: [PermissionCode.VIEW_BID],
    });
  });
});

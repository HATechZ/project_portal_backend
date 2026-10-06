import { PermissionCode } from '../../generated/prisma/client';
import { toAuthUserResponse } from './auth-response.mapper';

describe('toAuthUserResponse', () => {
  it('projects explicit final permissions and compatible role scopes, not workflow-action grants', () => {
    const response = toAuthUserResponse({
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
    } as never);

    expect(response).toMatchObject({
      roles: ['Client reviewer'],
      roleScopes: ['client_contact'],
      permissions: [
        PermissionCode.REQUEST_REVISION,
        PermissionCode.VIEW_DOCUMENT,
      ],
    });
  });
});

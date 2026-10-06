import { AuthUserResponseDto } from '../dtos';
import { SessionUser } from '../../common/security/session.types';

export function toAuthUserResponse(user: SessionUser): AuthUserResponseDto {
  const roles = user.userRolesByUserId.map(
    ({ role }) => role.systemRole?.systemCode ?? role.customCode!,
  );
  const roleScopes = user.userRolesByUserId.flatMap(({ role }) =>
    role.customScope ? [role.customScope] : [],
  );
  const permissions = user.userRolesByUserId.flatMap(({ role }) =>
    role.isActive
      ? role.rolePermissions
          .filter(({ revokedAt }) => revokedAt === null)
          .map(({ permission }) => permission.code)
      : [],
  );

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    country: user.country,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    roles: [...new Set(roles)].sort(),
    roleScopes: [...new Set(roleScopes)].sort(),
    permissions: [...new Set(permissions)].sort(),
  };
}

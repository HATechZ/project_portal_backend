import { AuthUserResponseDto } from '../dtos';
import { SessionUser } from '../../common/security/session.types';

export function toAuthUserResponse(user: SessionUser): AuthUserResponseDto {
  const roles = user.userRolesByUserId.map(({ role }) => role.code);
  const permissions = user.userRolesByUserId.flatMap(({ role }) =>
    role.workflowActionRolePermissionsByRoleId.map(({ action }) => action.code),
  );

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    country: user.country,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    roles: [...new Set(roles)].sort(),
    permissions: [...new Set(permissions)].sort(),
  };
}

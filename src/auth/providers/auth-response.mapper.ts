import { AuthUserResponseDto } from '../dtos';
import { SessionActor, SessionUser } from '../../common/security/session.types';

export function toAuthUserResponse(
  user: SessionUser,
  actor: SessionActor,
): AuthUserResponseDto {
  return toActiveActorResponse(user, actor);
}

function toActiveActorResponse(
  user: SessionUser,
  actor: SessionActor,
): AuthUserResponseDto {
  const role = actor.role;
  const permissions = role.rolePermissions
    .filter(({ revokedAt }) => revokedAt === null)
    .filter(
      ({ permission }) =>
        role.customScope === null ||
        permission.scopeCompatibilities.some(
          ({ scope }) => scope === role.customScope,
        ),
    )
    .map(({ permission }) => permission.code);

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    country: user.country,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    roles: [role.systemRole?.systemCode ?? role.customCode!],
    roleScopes: role.customScope ? [role.customScope] : [],
    permissions: [...new Set(permissions)].sort(),
  };
}

import { RoleResponseDto, UserRoleAssignmentResponseDto } from '../dtos';
import { RoleRecord, UserRoleAssignment } from '../repositories';

export function toRoleResponse(role: RoleRecord): RoleResponseDto {
  return {
    id: role.id,
    code: role.systemRole?.systemCode ?? role.customCode!,
    name: role.name,
    description: role.description,
    isSystemRole: role.isSystemRole,
    scope: role.customScope,
    createdAt: role.createdAt,
    permissions: role.rolePermissions.map(({ permission }) => ({
      ...permission,
      compatibleScopes: permission.scopeCompatibilities.map(
        ({ scope }) => scope,
      ),
    })),
  };
}

export function toUserRoleAssignmentResponse(
  assignment: UserRoleAssignment,
): UserRoleAssignmentResponseDto {
  return { ...assignment, role: toRoleResponse(assignment.role) };
}

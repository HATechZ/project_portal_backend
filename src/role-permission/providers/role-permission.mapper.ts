import { RoleResponseDto, UserRoleAssignmentResponseDto } from '../dtos';
import { RoleRecord, UserRoleAssignment } from '../repositories';

export function toRoleResponse(role: RoleRecord): RoleResponseDto {
  return {
    id: role.id,
    code: role.code,
    name: role.name,
    description: role.description,
    isSystemRole: role.isSystemRole,
    createdAt: role.createdAt,
    permissions: role.workflowActionRolePermissionsByRoleId.map(
      ({ action }) => action,
    ),
  };
}

export function toUserRoleAssignmentResponse(
  assignment: UserRoleAssignment,
): UserRoleAssignmentResponseDto {
  return { ...assignment, role: toRoleResponse(assignment.role) };
}

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
    permissions: role.rolePermissions.map(({ permission }) =>
      toPermissionResponse(permission),
    ),
  };
}

export function toPermissionResponse(permission: {
  id: string;
  code: RoleResponseDto['permissions'][number]['code'];
  displayName: string;
  description: string | null;
  category: RoleResponseDto['permissions'][number]['category'];
  actionType: RoleResponseDto['permissions'][number]['actionType'];
  resource: string;
  scopeCompatibilities: {
    scope: RoleResponseDto['permissions'][number]['compatibleScopes'][number];
  }[];
}): RoleResponseDto['permissions'][number] {
  return {
    id: permission.id,
    code: permission.code,
    displayName: permission.displayName,
    description: permission.description,
    category: permission.category,
    module: permission.category,
    actionType: permission.actionType,
    resource: permission.resource,
    compatibleScopes: permission.scopeCompatibilities.map(({ scope }) => scope),
  };
}

export function toUserRoleAssignmentResponse(
  assignment: UserRoleAssignment,
): UserRoleAssignmentResponseDto {
  return { ...assignment, role: toRoleResponse(assignment.role) };
}

import { Injectable } from '@nestjs/common';
import {
  AssignUserRoleDto,
  PermissionResponseDto,
  RoleResponseDto,
  SetRolePermissionsDto,
  UserRoleAssignmentResponseDto,
} from './dtos';
import {
  RolePermissionMutationProvider,
  RolePermissionQueryProvider,
} from './providers';

@Injectable()
export class RolePermissionService {
  constructor(
    private readonly mutationProvider: RolePermissionMutationProvider,
    private readonly queryProvider: RolePermissionQueryProvider,
  ) {}

  findRoles(): Promise<RoleResponseDto[]> {
    return this.queryProvider.findRoles();
  }
  findRole(id: string): Promise<RoleResponseDto> {
    return this.queryProvider.findRole(id);
  }
  findPermissions(): Promise<PermissionResponseDto[]> {
    return this.queryProvider.findPermissions();
  }
  findPermission(id: string): Promise<PermissionResponseDto> {
    return this.queryProvider.findPermission(id);
  }
  setRolePermissions(
    id: string,
    input: SetRolePermissionsDto,
  ): Promise<RoleResponseDto> {
    return this.mutationProvider.setRolePermissions(id, input);
  }
  findUserRoles(
    userId: string,
    includeRevoked: boolean,
  ): Promise<UserRoleAssignmentResponseDto[]> {
    return this.queryProvider.findUserRoles(userId, includeRevoked);
  }
  assignUserRole(
    userId: string,
    input: AssignUserRoleDto,
    assignedByUserId: string,
  ): Promise<UserRoleAssignmentResponseDto> {
    return this.mutationProvider.assignUserRole(
      userId,
      input,
      assignedByUserId,
    );
  }
  revokeUserRole(
    userId: string,
    roleId: string,
    performedByUserId: string,
  ): Promise<void> {
    return this.mutationProvider.revokeUserRole(
      userId,
      roleId,
      performedByUserId,
    );
  }
}

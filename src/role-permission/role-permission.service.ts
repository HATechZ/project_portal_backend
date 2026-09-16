import { Injectable } from '@nestjs/common';
import {
  AssignUserRoleDto,
  CreateCustomRoleDto,
  PermissionResponseDto,
  RoleResponseDto,
  SetRolePermissionsDto,
  UserRoleAssignmentResponseDto,
  RoleOptionResponseDto,
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
  createCustomRole(input: CreateCustomRoleDto): Promise<RoleResponseDto> {
    return this.mutationProvider.createCustomRole(input);
  }
  findPermissions(
    customRole?: boolean,
    scope?: string,
  ): Promise<PermissionResponseDto[]> {
    return this.queryProvider.findPermissions(customRole, scope);
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
  findRoleOptions(userId: string): Promise<RoleOptionResponseDto[]> {
    return this.queryProvider.findRoleOptions(userId);
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

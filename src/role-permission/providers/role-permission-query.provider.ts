import { Injectable, NotFoundException } from '@nestjs/common';
import {
  PermissionResponseDto,
  RoleResponseDto,
  UserRoleAssignmentResponseDto,
} from '../dtos';
import { RolePermissionRepository } from '../repositories';
import {
  toRoleResponse,
  toUserRoleAssignmentResponse,
} from './role-permission.mapper';

@Injectable()
export class RolePermissionQueryProvider {
  constructor(private readonly repository: RolePermissionRepository) {}

  async findRoles(): Promise<RoleResponseDto[]> {
    return (await this.repository.findRoles()).map(toRoleResponse);
  }

  async findRole(id: string): Promise<RoleResponseDto> {
    const role = await this.repository.findRole(id);
    if (!role) throw new NotFoundException(`Role with ID ${id} was not found`);
    return toRoleResponse(role);
  }

  findPermissions(): Promise<PermissionResponseDto[]> {
    return this.repository.findVisiblePermissions();
  }

  async findPermission(id: string): Promise<PermissionResponseDto> {
    const permission = await this.repository.findPermission(id);
    if (!permission)
      throw new NotFoundException(`Permission with ID ${id} was not found`);
    return permission;
  }

  async findUserRoles(
    userId: string,
    includeRevoked: boolean,
  ): Promise<UserRoleAssignmentResponseDto[]> {
    if (!(await this.repository.findUser(userId))) {
      throw new NotFoundException(`User with ID ${userId} was not found`);
    }
    return (await this.repository.findUserRoles(userId, includeRevoked)).map(
      toUserRoleAssignmentResponse,
    );
  }
}

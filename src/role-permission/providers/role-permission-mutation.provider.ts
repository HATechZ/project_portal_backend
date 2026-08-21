import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActorRoleCode, Prisma } from '../../generated/prisma/client';
import {
  AssignUserRoleDto,
  RoleResponseDto,
  SetRolePermissionsDto,
  UserRoleAssignmentResponseDto,
} from '../dtos';
import { RolePermissionRepository, RoleRecord } from '../repositories';
import {
  toRoleResponse,
  toUserRoleAssignmentResponse,
} from './role-permission.mapper';

@Injectable()
export class RolePermissionMutationProvider {
  constructor(private readonly repository: RolePermissionRepository) {}

  async setRolePermissions(
    id: string,
    input: SetRolePermissionsDto,
  ): Promise<RoleResponseDto> {
    await this.requireRole(id);
    if (new Set(input.permissionCodes).size !== input.permissionCodes.length)
      throw new BadRequestException(
        'Duplicate permission codes are not allowed',
      );
    const existingCodes = new Set(
      (await this.repository.findPermissions()).map(({ code }) => code),
    );
    const missing = input.permissionCodes.filter(
      (code) => !existingCodes.has(code),
    );
    if (missing.length)
      throw new BadRequestException(
        `Permission definitions are not seeded: ${missing.join(', ')}`,
      );
    return toRoleResponse(
      await this.repository.replaceRolePermissions(id, input.permissionCodes),
    );
  }

  async assignUserRole(
    userId: string,
    input: AssignUserRoleDto,
    assignedByUserId: string,
  ): Promise<UserRoleAssignmentResponseDto> {
    await Promise.all([
      this.requireUser(userId),
      this.requireRole(input.roleId),
    ]);
    if (await this.repository.findActiveAssignment(userId, input.roleId))
      throw new ConflictException('The user already has this role');
    try {
      return toUserRoleAssignmentResponse(
        await this.repository.createAssignment(
          userId,
          input.roleId,
          assignedByUserId,
        ),
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('The user already has this role');
      throw error;
    }
  }

  async revokeUserRole(
    userId: string,
    roleId: string,
    performedByUserId: string,
  ): Promise<void> {
    await this.requireUser(userId);
    const role = await this.requireRole(roleId);
    if (
      userId === performedByUserId &&
      role.code === ActorRoleCode.system_admin
    )
      throw new ConflictException(
        'You cannot revoke your own system administrator role',
      );
    const assignment = await this.repository.findActiveAssignment(
      userId,
      roleId,
    );
    if (!assignment)
      throw new NotFoundException('The user does not have this active role');
    try {
      const revoked = await this.repository.revokeAssignment(
        assignment.id,
        roleId,
        role.code === ActorRoleCode.system_admin,
      );
      if (!revoked) {
        throw new ConflictException(
          'The tenant must retain at least one active system administrator',
        );
      }
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'The role assignment changed concurrently; retry the request',
        );
      }
      throw error;
    }
  }

  private async requireRole(id: string): Promise<RoleRecord> {
    const role = await this.repository.findRole(id);
    if (!role) throw new NotFoundException(`Role with ID ${id} was not found`);
    return role;
  }

  private async requireUser(id: string): Promise<void> {
    if (!(await this.repository.findUser(id)))
      throw new NotFoundException(`User with ID ${id} was not found`);
  }
}

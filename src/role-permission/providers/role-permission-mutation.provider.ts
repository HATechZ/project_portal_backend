import { HttpStatus, Injectable } from '@nestjs/common';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import { ActorRoleCode } from '../../generated/prisma/client';
import { RoleAssignmentRepository } from '../repositories/role-assignment.repository';
import {
  AssignUserRoleDto,
  CreateCustomRoleDto,
  RoleResponseDto,
  SetRolePermissionsDto,
  UserRoleAssignmentResponseDto,
} from '../dtos';
import { RolePermissionRepository, RoleRecord } from '../repositories';
import { CustomRoleRepository } from '../repositories/custom-role.repository';
import { isCustomRolePermissionAllowed } from './custom-role-policy';
import {
  toRoleResponse,
  toUserRoleAssignmentResponse,
} from './role-permission.mapper';

@Injectable()
export class RolePermissionMutationProvider {
  constructor(
    private readonly repository: RolePermissionRepository,
    private readonly assignments: RoleAssignmentRepository,
    private readonly customRoles: CustomRoleRepository,
  ) {}

  async createCustomRole(input: CreateCustomRoleDto): Promise<RoleResponseDto> {
    await this.assertValidCustomPermissions(input.scope, input.permissionCodes);
    return toRoleResponse(await this.customRoles.create(input));
  }

  async setRolePermissions(
    id: string,
    input: SetRolePermissionsDto,
  ): Promise<RoleResponseDto> {
    await this.requireRole(id);
    if (new Set(input.permissionCodes).size !== input.permissionCodes.length)
      throw new AppException({
        code: AppErrorCode.BadRequest,
        status: HttpStatus.BAD_REQUEST,
        message:
          'The same permission was selected more than once. Remove duplicates and try again.',
      });
    const existingCodes = new Set(
      (await this.repository.findPermissions()).map(({ code }) => code),
    );
    const missing = input.permissionCodes.filter(
      (code) => !existingCodes.has(code),
    );
    if (missing.length)
      throw new AppException({
        code: AppErrorCode.BadRequest,
        status: HttpStatus.BAD_REQUEST,
        message:
          'Some selected permissions are not available. Refresh the permissions and try again.',
      });
    const role = await this.requireRole(id);
    if (!role.isSystemRole) {
      await this.assertValidCustomPermissions(
        role.customScope as Parameters<
          typeof this.assertValidCustomPermissions
        >[0],
        input.permissionCodes,
      );
    }
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
    // The repository atomically reuses the grant and ensures its role-only profile.
    return toUserRoleAssignmentResponse(
      await this.assignments.ensureAssignment(
        userId,
        input.roleId,
        assignedByUserId,
      ),
    );
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
      role.systemRole?.systemCode === ActorRoleCode.system_admin
    )
      throw new AppException({
        code: AppErrorCode.Conflict,
        status: HttpStatus.CONFLICT,
        message:
          'You cannot remove your own System Administrator role. Ask another administrator to make this change.',
      });
    const assignment = await this.repository.findActiveAssignment(
      userId,
      roleId,
    );
    if (!assignment)
      throw new AppException({
        code: AppErrorCode.NotFound,
        status: HttpStatus.NOT_FOUND,
        message: 'Role not found. Refresh the available roles and try again.',
      });
    const revoked = await this.repository.revokeAssignment(
      assignment.id,
      roleId,
      role.systemRole?.systemCode === ActorRoleCode.system_admin,
    );
    if (!revoked) {
      throw new AppException({
        code: AppErrorCode.Conflict,
        status: HttpStatus.CONFLICT,
        message:
          'This role cannot be removed because the workspace must have at least one active System Administrator.',
      });
    }
  }

  private async requireRole(id: string): Promise<RoleRecord> {
    const role = await this.repository.findRole(id);
    if (!role)
      throw new AppException({
        code: AppErrorCode.NotFound,
        status: HttpStatus.NOT_FOUND,
        message: 'Role not found. Refresh the available roles and try again.',
      });
    return role;
  }

  private async requireUser(id: string): Promise<void> {
    if (!(await this.repository.findUser(id)))
      throw new AppException({
        code: AppErrorCode.NotFound,
        status: HttpStatus.NOT_FOUND,
        message: 'User not found. Check the selected user and try again.',
      });
  }

  private async assertValidCustomPermissions(
    scope: Parameters<typeof isCustomRolePermissionAllowed>[0],
    codes: SetRolePermissionsDto['permissionCodes'],
  ): Promise<void> {
    if (new Set(codes).size !== codes.length) {
      throw new AppException({
        code: AppErrorCode.BadRequest,
        status: HttpStatus.BAD_REQUEST,
        message:
          'The same permission was selected more than once. Remove duplicates and try again.',
      });
    }
    const catalog = new Set(
      (await this.repository.findPermissions()).map(({ code }) => code),
    );
    if (codes.some((code) => !catalog.has(code))) {
      throw new AppException({
        code: AppErrorCode.BadRequest,
        status: HttpStatus.BAD_REQUEST,
        message:
          'Some selected permissions are not available. Refresh the permissions and try again.',
      });
    }
    if (codes.some((code) => !isCustomRolePermissionAllowed(scope, code))) {
      throw new AppException({
        code: AppErrorCode.BadRequest,
        status: HttpStatus.BAD_REQUEST,
        message:
          'The selected permission is not available for this custom role scope.',
      });
    }
  }
}

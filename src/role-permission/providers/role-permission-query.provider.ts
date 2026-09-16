import { HttpStatus, Injectable } from '@nestjs/common';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import {
  PermissionResponseDto,
  RoleResponseDto,
  UserRoleAssignmentResponseDto,
} from '../dtos';
import { RolePermissionRepository } from '../repositories';
import { RoleOptionsRepository } from '../repositories/role-options.repository';
import {
  toRoleResponse,
  toUserRoleAssignmentResponse,
} from './role-permission.mapper';
import {
  customRolePermissionCodes,
  isCustomRoleScope,
} from './custom-role-policy';

@Injectable()
export class RolePermissionQueryProvider {
  constructor(
    private readonly repository: RolePermissionRepository,
    private readonly options: RoleOptionsRepository,
  ) {}

  async findRoleOptions(userId: string) {
    const roles = await this.options.findForUser(userId);
    if (!roles)
      throw new AppException({
        code: AppErrorCode.NotFound,
        status: HttpStatus.NOT_FOUND,
        message: 'User not found. Check the selected user and try again.',
      });
    return roles.map(
      ({
        id,
        name,
        description,
        isSystemRole,
        customScope,
        customCode,
        systemRole,
      }) => ({
        id,
        name,
        description,
        isSystemRole,
        scope: customScope,
        code: systemRole?.systemCode ?? customCode!,
      }),
    );
  }

  async findRoles(): Promise<RoleResponseDto[]> {
    return (await this.repository.findRoles()).map(toRoleResponse);
  }

  async findRole(id: string): Promise<RoleResponseDto> {
    const role = await this.repository.findRole(id);
    if (!role)
      throw new AppException({
        code: AppErrorCode.NotFound,
        status: HttpStatus.NOT_FOUND,
        message: 'Role not found. Refresh the available roles and try again.',
      });
    return toRoleResponse(role);
  }

  async findPermissions(
    customRole?: boolean,
    scope?: string,
  ): Promise<PermissionResponseDto[]> {
    const permissions = await this.repository.findVisiblePermissions();
    if (!customRole) return permissions;
    if (!scope || !isCustomRoleScope(scope)) return [];
    const allowed = new Set(customRolePermissionCodes(scope));
    return permissions.filter(({ code }) => allowed.has(code));
  }

  async findPermission(id: string): Promise<PermissionResponseDto> {
    const permission = await this.repository.findPermission(id);
    if (!permission)
      throw new AppException({
        code: AppErrorCode.NotFound,
        status: HttpStatus.NOT_FOUND,
        message:
          'Permission not found. Refresh the available permissions and try again.',
      });
    return permission;
  }

  async findUserRoles(
    userId: string,
    includeRevoked: boolean,
  ): Promise<UserRoleAssignmentResponseDto[]> {
    if (!(await this.repository.findUser(userId))) {
      throw new AppException({
        code: AppErrorCode.NotFound,
        status: HttpStatus.NOT_FOUND,
        message: 'User not found. Check the selected user and try again.',
      });
    }
    return (await this.repository.findUserRoles(userId, includeRevoked)).map(
      toUserRoleAssignmentResponse,
    );
  }
}

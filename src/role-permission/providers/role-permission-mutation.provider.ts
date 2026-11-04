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
import { isCustomRoleScope, type CustomRoleScope } from './custom-role-policy';
import {
  toRoleResponse,
  toUserRoleAssignmentResponse,
} from './role-permission.mapper';
import { starterRole } from '../../common/security/starter-role-definition';

@Injectable()
export class RolePermissionMutationProvider {
  constructor(
    private readonly repository: RolePermissionRepository,
    private readonly assignments: RoleAssignmentRepository,
    private readonly customRoles: CustomRoleRepository,
  ) {}

  async createCustomRole(input: CreateCustomRoleDto): Promise<RoleResponseDto> {
    await this.assertValidCustomPermissions(input.scope, input.permissionIds);
    return toRoleResponse(await this.customRoles.create(input));
  }

  async setRolePermissions(
    id: string,
    input: SetRolePermissionsDto,
  ): Promise<RoleResponseDto> {
    return this.repository.withRoleMutation(async () => {
      const role = await this.requireRole(id);
      const permissionIds =
        input.permissionIds ??
        role.rolePermissions.map(({ permission }) => permission.id);
      this.assertUniquePermissionIds(permissionIds);
      const protectedStarter = starterRole(role.customCode ?? '');
      if (
        protectedStarter &&
        input.scope &&
        input.scope !== protectedStarter.scope
      )
        throw new AppException({
          code: AppErrorCode.Conflict,
          status: HttpStatus.CONFLICT,
          message: 'The protected starter role scope cannot be changed.',
        });
      if (!role.isSystemRole) {
        const scope = input.scope ?? (role.customScope as CustomRoleScope);
        await this.assertValidCustomPermissions(scope, permissionIds);
        if (scope !== role.customScope) {
          const affectedBindings =
            await this.repository.findAffectedScopeBindings(id, scope);
          if (affectedBindings.length)
            throw new AppException({
              code: AppErrorCode.BadRequest,
              status: HttpStatus.BAD_REQUEST,
              message:
                'Existing role assignments are incompatible with the requested scope.',
              details: {
                canSave: false,
                incompatiblePermissions: [],
                affectedBindings,
              },
            });
        }
        return toRoleResponse(
          await this.repository.replaceRolePermissions(
            id,
            permissionIds,
            input.scope,
          ),
        );
      }
      if (input.scope)
        throw new AppException({
          code: AppErrorCode.BadRequest,
          status: HttpStatus.BAD_REQUEST,
          message: 'System roles do not have a configurable custom role scope.',
        });
      throw new AppException({
        code: AppErrorCode.Forbidden,
        status: HttpStatus.FORBIDDEN,
        message:
          'System role permissions are bootstrap-managed and cannot be changed through this API.',
      });
    });
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
        input.teamId,
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
      role.systemRole?.systemCode === ActorRoleCode.tenant_super_admin
    )
      throw new AppException({
        code: AppErrorCode.Conflict,
        status: HttpStatus.CONFLICT,
        message:
          'You cannot remove your own Tenant Super Administrator role. Ask another administrator to make this change.',
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
      userId,
      roleId,
      role.systemRole?.systemCode === ActorRoleCode.tenant_super_admin,
    );
    if (!revoked) {
      throw new AppException({
        code: AppErrorCode.Conflict,
        status: HttpStatus.CONFLICT,
        message:
          'This role cannot be removed because the workspace must have at least one active Tenant Super Administrator.',
      });
    }
  }

  async reassignUserRole(
    userId: string,
    currentRoleId: string,
    newRoleId: string,
    assignedByUserId: string,
  ): Promise<UserRoleAssignmentResponseDto> {
    return toUserRoleAssignmentResponse(
      await this.assignments.reassign(
        userId,
        currentRoleId,
        newRoleId,
        assignedByUserId,
      ),
    );
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
    scope: CustomRoleScope,
    permissionIds: string[],
  ): Promise<void> {
    if (!isCustomRoleScope(scope)) {
      throw new AppException({
        code: AppErrorCode.BadRequest,
        status: HttpStatus.BAD_REQUEST,
        message: 'Custom roles must use a supported system-defined scope.',
      });
    }
    this.assertUniquePermissionIds(permissionIds);
    const permissions =
      await this.repository.findPermissionsByIds(permissionIds);
    const incompatiblePermissions = permissions
      .filter(
        ({ scopeCompatibilities }) =>
          !scopeCompatibilities.some(
            ({ scope: compatible }) => compatible === scope,
          ),
      )
      .map(({ id, code, displayName }) => ({ id, code, name: displayName }));
    const unknownPermissionIds = permissionIds.filter(
      (id) => !permissions.some((permission) => permission.id === id),
    );
    if (incompatiblePermissions.length || unknownPermissionIds.length) {
      throw new AppException({
        code: AppErrorCode.BadRequest,
        status: HttpStatus.BAD_REQUEST,
        message:
          'Some selected permissions are incompatible with the requested role scope or no longer exist.',
        details: {
          canSave: false,
          incompatiblePermissions,
          unknownPermissionIds,
          affectedBindings: [],
        },
      });
    }
    await this.assertDependencies(scope, permissionIds);
  }

  private async assertDependencies(
    scope: CustomRoleScope,
    permissionIds: string[],
  ): Promise<void> {
    const catalogue = await this.repository.findPermissionDependencyGraph();
    const byId = new Map(
      catalogue.map((permission) => [permission.id, permission]),
    );
    const selected = new Set(permissionIds);
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (id: string): void => {
      if (visiting.has(id))
        throw new AppException({
          code: AppErrorCode.BadRequest,
          status: HttpStatus.BAD_REQUEST,
          message: 'The permission catalogue contains a circular dependency.',
        });
      if (visited.has(id)) return;
      const permission = byId.get(id);
      if (!permission)
        throw new AppException({
          code: AppErrorCode.BadRequest,
          status: HttpStatus.BAD_REQUEST,
          message: 'The permission catalogue contains an unknown dependency.',
        });
      visiting.add(id);
      for (const {
        requiredPermissionId,
      } of permission.requiredPermissionDependencies) {
        const required = byId.get(requiredPermissionId);
        if (!required || !selected.has(requiredPermissionId))
          throw new AppException({
            code: AppErrorCode.BadRequest,
            status: HttpStatus.BAD_REQUEST,
            message:
              'Select every permission required by the selected permission.',
          });
        if (
          !required.scopeCompatibilities.some(
            ({ scope: compatible }) => compatible === scope,
          )
        )
          throw new AppException({
            code: AppErrorCode.BadRequest,
            status: HttpStatus.BAD_REQUEST,
            message:
              'The permission catalogue has a dependency incompatible with this role scope.',
          });
        visit(requiredPermissionId);
      }
      visiting.delete(id);
      visited.add(id);
    };

    for (const id of selected) visit(id);
  }

  private assertUniquePermissionIds(permissionIds: string[]): void {
    if (new Set(permissionIds).size !== permissionIds.length)
      throw new AppException({
        code: AppErrorCode.BadRequest,
        status: HttpStatus.BAD_REQUEST,
        message:
          'The same permission was selected more than once. Remove duplicates and try again.',
      });
  }

  private async assertPermissionsExist(permissionIds: string[]): Promise<void> {
    if (
      (await this.repository.findPermissionsByIds(permissionIds)).length !==
      permissionIds.length
    )
      throw new AppException({
        code: AppErrorCode.BadRequest,
        status: HttpStatus.BAD_REQUEST,
        message:
          'Some selected permissions are not available. Refresh the permissions and try again.',
      });
  }
}

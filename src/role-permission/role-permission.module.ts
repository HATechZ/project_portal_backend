import { Module } from '@nestjs/common';
import {
  CustomRoleRepository,
  RoleOptionsRepository,
  RolePermissionRepository,
} from './repositories';
import { RoleAssignmentRepository } from './repositories/role-assignment.repository';
import {
  RolePermissionMutationProvider,
  RolePermissionQueryProvider,
} from './providers';
import { RolePermissionController } from './role-permission.controller';
import { RolePermissionService } from './role-permission.service';
import { UserRoleController } from './user-role.controller';

@Module({
  controllers: [RolePermissionController, UserRoleController],
  providers: [
    RolePermissionService,
    RolePermissionMutationProvider,
    RolePermissionQueryProvider,
    RolePermissionRepository,
    CustomRoleRepository,
    RoleOptionsRepository,
    RoleAssignmentRepository,
  ],
  exports: [RolePermissionQueryProvider],
})
export class RolePermissionModule {}

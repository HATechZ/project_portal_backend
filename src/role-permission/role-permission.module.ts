import { Module } from '@nestjs/common';
import { RolePermissionRepository } from './repositories';
import { RoleAssignmentRepository } from './repositories/role-assignment.repository';
import {
  RolePermissionMutationProvider,
  RolePermissionQueryProvider,
} from './providers';
import { RolePermissionController } from './role-permission.controller';
import { RolePermissionService } from './role-permission.service';

@Module({
  controllers: [RolePermissionController],
  providers: [
    RolePermissionService,
    RolePermissionMutationProvider,
    RolePermissionQueryProvider,
    RolePermissionRepository,
    RoleAssignmentRepository,
  ],
  exports: [RolePermissionQueryProvider],
})
export class RolePermissionModule {}

import { Module } from '@nestjs/common';
import { RolePermissionRepository } from './repositories';
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
  ],
  exports: [RolePermissionQueryProvider],
})
export class RolePermissionModule {}

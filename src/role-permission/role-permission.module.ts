import { Module } from '@nestjs/common';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
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
    TenantContextGuard,
  ],
  exports: [RolePermissionQueryProvider],
})
export class RolePermissionModule {}

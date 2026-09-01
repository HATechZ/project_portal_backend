import { Global, Module } from '@nestjs/common';
import { TenantActivationService } from './tenant-activation.service';
import { TenantContextGuard } from './tenant-context.guard';
import { TenantRepository } from './tenant.repository';

@Global()
@Module({
  providers: [TenantActivationService, TenantContextGuard, TenantRepository],
  exports: [TenantContextGuard],
})
export class TenantModule {}

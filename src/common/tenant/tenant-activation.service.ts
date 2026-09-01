import { Injectable } from '@nestjs/common';
import { RedisService } from '../../infra/redis/redis.service';
import { TenantRepository } from './tenant.repository';

const TENANT_ACTIVATION_TTL_SECONDS = 60;

@Injectable()
export class TenantActivationService {
  constructor(
    private readonly redis: RedisService,
    private readonly tenants: TenantRepository,
  ) {}

  isActive(tenantId: string): Promise<boolean> {
    return this.redis.remember(
      `tenant:${tenantId}:active`,
      () => this.tenants.isActive(tenantId),
      TENANT_ACTIVATION_TTL_SECONDS,
    );
  }
}

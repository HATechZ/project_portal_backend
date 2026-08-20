import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { AppConfiguration } from '../../config/configuration';
import {
  createTenantPrismaClient,
  TenantPrismaClient,
} from './tenant-prisma.extension';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly tenantClient: TenantPrismaClient;

  constructor(config: ConfigService<AppConfiguration, true>) {
    super({
      adapter: new PrismaPg({
        connectionString: config.get('database.url', { infer: true }),
      }),
    });
    this.tenantClient = createTenantPrismaClient(this);
  }

  get scoped(): TenantPrismaClient {
    return this.tenantClient;
  }

  get unscoped(): PrismaClient {
    return this;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

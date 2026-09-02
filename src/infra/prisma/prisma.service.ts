import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
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
  private readonly logger = new Logger(PrismaService.name);
  private readonly tenantClient: TenantPrismaClient;
  private readonly privilegedClient: PrismaClient;

  constructor(config: ConfigService<AppConfiguration, true>) {
    super({
      adapter: new PrismaPg({
        connectionString: config.get('database.url', { infer: true }),
      }),
    });
    this.privilegedClient = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: config.get('database.privilegedUrl', { infer: true }),
      }),
    });
    this.tenantClient = createTenantPrismaClient(this);
  }

  get scoped(): TenantPrismaClient {
    return this.tenantClient;
  }

  get unscoped(): PrismaClient {
    return this.privilegedClient;
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      await this.privilegedClient.$connect();
      this.logger.log(
        'Application and privileged database connections established',
      );
    } catch (error) {
      this.logger.error(
        'Database connection failed',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      this.$disconnect(),
      this.privilegedClient.$disconnect(),
    ]);
    this.logger.log('Application and privileged database connections closed');
  }
}

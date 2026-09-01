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
import {
  assertDatabaseRole,
  DatabaseRoleIdentity,
} from './database-role.assertion';

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
      await this.verifyRuntimeRole(this, 'app_user', false);
      await this.verifyRuntimeRole(this.privilegedClient, 'app_relay', true);
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

  private async verifyRuntimeRole(
    client: PrismaClient,
    expectedRole: string,
    expectedBypassRls: boolean,
  ): Promise<void> {
    const identities = await client.$queryRaw<DatabaseRoleIdentity[]>`
      SELECT
        current_user::text AS "currentUser",
        session_user::text AS "sessionUser",
        role_definition.rolbypassrls AS "bypassRls",
        role_definition.rolsuper AS "superuser",
        role_definition.rolcreaterole AS "createRole",
        CASE
          WHEN current_user = 'app_user'
          THEN pg_has_role(current_user, 'app_relay', 'MEMBER')
          ELSE false
        END AS "memberOfRelay",
        EXISTS (
          SELECT 1
          FROM pg_class AS table_definition
          JOIN pg_namespace AS table_schema
            ON table_schema.oid = table_definition.relnamespace
          WHERE table_schema.nspname = 'public'
            AND table_definition.relkind = 'r'
            AND table_definition.relowner = role_definition.oid
        ) AS "ownsPublicTables"
      FROM pg_roles AS role_definition
      WHERE role_definition.rolname = current_user
    `;
    assertDatabaseRole(identities[0], expectedRole, expectedBypassRls);
  }
}

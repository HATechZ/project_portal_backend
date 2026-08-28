import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { environmentSchema } from './config/env.schema';
import { OpenApiModule } from './common/swagger/openapi.module';
import { CryptoModule } from './infra/crypto/crypto.module';
import { MailModule } from './infra/mail/mail.module';
import { MailWorkersModule } from './infra/mail/mail-workers.module';
import { MessagingModule } from './infra/messaging/messaging.module';
import { PrismaModule } from './infra/prisma/prisma.module';
import { RedisModule } from './infra/redis/redis.module';
import { ThrottlerModule } from './infra/throttler/throttler.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { TenantContextMiddleware } from './common/tenant/tenant-context.middleware';
import { TenantContextGuard } from './common/tenant/tenant-context.guard';
import { SecurityModule } from './common/security/security.module';
import { RolePermissionModule } from './role-permission/role-permission.module';
import { CompanyModule } from './company/company.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validationSchema: environmentSchema,
    }),
    OpenApiModule.register(),
    PrismaModule,
    RedisModule,
    ThrottlerModule,
    CryptoModule,
    SecurityModule,
    MessagingModule,
    MailModule,
    MailWorkersModule,
    UserModule,
    AuthModule,
    RolePermissionModule,
    CompanyModule,
  ],
  controllers: [AppController],
  providers: [AppService, TenantContextGuard],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantContextMiddleware).forRoutes('{*path}');
  }
}

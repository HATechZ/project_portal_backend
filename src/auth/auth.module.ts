import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AccessTokenGuard } from './guards/access-token/access-token.guard';
import { AuthenticationGuard } from './guards/authentication/authentication.guard';
import { PermissionsGuard } from './guards/permissions/permissions.guard';
import { SystemAdminGuard } from './guards/permissions/system-admin.guard';
import { AuthHashingProvider, AuthTokenProvider } from './providers';
import { AuthPasswordResetProvider } from './providers/auth-password-reset.provider';
import { AuthSessionRepository } from './repositories';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { MailModule } from '../infra/mail/mail.module';

@Module({
  imports: [JwtModule.register({}), MailModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthTokenProvider,
    AuthHashingProvider,
    AuthPasswordResetProvider,
    AuthSessionRepository,
    AccessTokenGuard,
    AuthenticationGuard,
    PermissionsGuard,
    SystemAdminGuard,
    TenantContextGuard,
  ],
  exports: [
    AuthHashingProvider,
    AuthTokenProvider,
    AccessTokenGuard,
    AuthenticationGuard,
    PermissionsGuard,
    SystemAdminGuard,
  ],
})
export class AuthModule {}

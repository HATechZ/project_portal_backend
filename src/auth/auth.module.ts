import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthenticatedGuard } from './guards/authenticated.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { SystemAdminGuard } from './guards/system-admin.guard';
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
    AuthenticatedGuard,
    PermissionsGuard,
    SystemAdminGuard,
    TenantContextGuard,
  ],
  exports: [
    AuthHashingProvider,
    AuthTokenProvider,
    AuthenticatedGuard,
    PermissionsGuard,
    SystemAdminGuard,
  ],
})
export class AuthModule {}

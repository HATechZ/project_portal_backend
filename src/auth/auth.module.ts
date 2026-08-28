import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthTokenProvider } from './providers';
import { AuthPasswordResetProvider } from './providers/auth-password-reset.provider';
import { AuthSessionRepository } from './repositories';
import { SESSION_AUTHENTICATOR } from '../common/security/session-authenticator.port';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { MailModule } from '../infra/mail/mail.module';

/**
 * Global, and exporting exactly one thing: the binding that lets the shared
 * guards authenticate without anyone importing this module.
 *
 * Everything else — issuing, rotating, revoking, password reset — stays behind
 * the boundary. Modules that need a session read it off the request; modules
 * that need to hash a password use `PASSWORD_HASHER` (Art. XI).
 */
@Global()
@Module({
  imports: [JwtModule.register({}), MailModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthTokenProvider,
    AuthPasswordResetProvider,
    AuthSessionRepository,
    TenantContextGuard,
    { provide: SESSION_AUTHENTICATOR, useExisting: AuthTokenProvider },
  ],
  exports: [SESSION_AUTHENTICATOR],
})
export class AuthModule {}

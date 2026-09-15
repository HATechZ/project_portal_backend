import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthTokenProvider } from './providers';
import { AuthPasswordResetProvider } from './providers/auth-password-reset.provider';
import {
  AuthSessionRepository,
  LoginTenantResolverRepository,
  RefreshTenantResolverRepository,
} from './repositories';
import { SESSION_AUTHENTICATOR } from '../common/security/session-authenticator.port';
import { PASSWORD_SETUP_INITIATOR } from '../common/security/password-setup.port';
import { MailModule } from '../infra/mail/mail.module';
import { ActorProfileController } from './actor-profile.controller';
import { ActorProfileService } from './actor-profile.service';
import { ActorProfileRepository } from './repositories/actor-profile.repository';
import { SessionAdministrationController } from './session-administration.controller';
import { SessionAdministrationService } from './session-administration.service';
import { SessionAdministrationRepository } from './repositories/session-administration.repository';
import { PasswordRecoveryRepository } from './repositories/password-recovery.repository';

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
  controllers: [
    AuthController,
    ActorProfileController,
    SessionAdministrationController,
  ],
  providers: [
    AuthService,
    AuthTokenProvider,
    AuthPasswordResetProvider,
    AuthSessionRepository,
    LoginTenantResolverRepository,
    RefreshTenantResolverRepository,
    ActorProfileService,
    ActorProfileRepository,
    SessionAdministrationService,
    SessionAdministrationRepository,
    PasswordRecoveryRepository,
    { provide: SESSION_AUTHENTICATOR, useExisting: AuthTokenProvider },
    { provide: PASSWORD_SETUP_INITIATOR, useExisting: AuthPasswordResetProvider },
  ],
  exports: [SESSION_AUTHENTICATOR, PASSWORD_SETUP_INITIATOR],
})
export class AuthModule {}

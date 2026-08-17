import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthenticatedGuard } from './guards/authenticated.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { SystemAdminGuard } from './guards/system-admin.guard';
import { AuthHashingProvider, AuthSessionProvider } from './providers';
import { AuthSessionRepository } from './repositories';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthSessionProvider,
    AuthHashingProvider,
    AuthSessionRepository,
    AuthenticatedGuard,
    PermissionsGuard,
    SystemAdminGuard,
  ],
  exports: [
    AuthHashingProvider,
    AuthSessionProvider,
    AuthenticatedGuard,
    PermissionsGuard,
    SystemAdminGuard,
  ],
})
export class AuthModule {}

import { Global, Module } from '@nestjs/common';
import { AccessTokenGuard } from './access-token.guard';
import { AuthenticationGuard } from './authentication.guard';
import { ObjectScopeGuard } from './object-scope.guard';
import { ObjectScopeProvider } from './object-scope.provider';
import { PermissionsGuard } from './permissions.guard';
import { SystemAdminGuard } from './system-admin.guard';

/**
 * The guards every module protects its routes with.
 *
 * Global so a controller can apply them without importing `AuthModule` — that
 * import was the reason `user`, `company`, and `role-permission` each depended
 * on a sibling feature module (Art. XI). The guards reach `auth` through
 * `SESSION_AUTHENTICATOR`, which `AuthModule` binds; nothing here imports it.
 */
@Global()
@Module({
  providers: [
    ObjectScopeProvider,
    AccessTokenGuard,
    AuthenticationGuard,
    ObjectScopeGuard,
    PermissionsGuard,
    SystemAdminGuard,
  ],
  exports: [
    ObjectScopeProvider,
    AccessTokenGuard,
    AuthenticationGuard,
    ObjectScopeGuard,
    PermissionsGuard,
    SystemAdminGuard,
  ],
})
export class SecurityModule {}

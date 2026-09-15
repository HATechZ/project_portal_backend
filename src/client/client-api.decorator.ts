import { Controller, UseGuards, applyDecorators } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import {
  ApiStandardBadRequestResponse,
  ApiStandardConflictResponse,
  ApiStandardForbiddenResponse,
  ApiStandardNotFoundResponse,
  ApiStandardUnauthorizedResponse,
} from '../common/decorators/api-standard-response.decorator';
import { AccessTokenGuard } from '../common/security/access-token.guard';
import { AuthenticationGuard } from '../common/security/authentication.guard';
import { ObjectScopeGuard } from '../common/security/object-scope.guard';
import { PermissionsGuard } from '../common/security/permissions.guard';
import { SystemAdminGuard } from '../common/security/system-admin.guard';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';

/** Route prefix, guard chain, and shared error docs for every Client controller. */
export function ClientApiController(): ClassDecorator {
  return applyDecorators(
    ApiTags('client'),
    ApiSecurity('bearer'),
    Controller('client'),
    UseGuards(
      AccessTokenGuard,
      TenantContextGuard,
      AuthenticationGuard,
      ObjectScopeGuard,
      SystemAdminGuard,
      PermissionsGuard,
    ),
    ApiStandardBadRequestResponse(),
    ApiStandardUnauthorizedResponse(),
    ApiStandardForbiddenResponse('System administrator access required'),
    ApiStandardNotFoundResponse('Client was not found'),
    ApiStandardConflictResponse('Client request conflicts with current data'),
  );
}

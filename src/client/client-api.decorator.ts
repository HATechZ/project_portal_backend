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
import { FinalPermissionsGuard } from '../common/security/final-permissions.guard';
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
      FinalPermissionsGuard,
    ),
    ApiStandardBadRequestResponse(),
    ApiStandardUnauthorizedResponse(),
    ApiStandardForbiddenResponse('explicit permission required'),
    ApiStandardNotFoundResponse('Client was not found'),
    ApiStandardConflictResponse('Client request conflicts with current data'),
  );
}

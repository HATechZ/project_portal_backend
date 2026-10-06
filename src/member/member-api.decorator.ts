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

/** Route prefix, guard chain, permission, and shared error docs for Member. */
export function MemberApiController(): ClassDecorator {
  return applyDecorators(
    ApiTags('member'),
    ApiSecurity('bearer'),
    Controller('member'),
    UseGuards(
      AccessTokenGuard,
      TenantContextGuard,
      AuthenticationGuard,
      FinalPermissionsGuard,
    ),
    ApiStandardBadRequestResponse(),
    ApiStandardUnauthorizedResponse(),
    ApiStandardForbiddenResponse(
      'explicit permission or resource condition denied',
    ),
    ApiStandardNotFoundResponse('Member was not found'),
    ApiStandardConflictResponse('Member request conflicts with current data'),
  );
}

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
import { Permissions } from '../common/security/permissions.decorator';
import { PermissionsGuard } from '../common/security/permissions.guard';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { WorkflowActionCode } from '../generated/prisma/client';

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
      ObjectScopeGuard,
      PermissionsGuard,
    ),
    Permissions(WorkflowActionCode.ADD_MEMBER),
    ApiStandardBadRequestResponse(),
    ApiStandardUnauthorizedResponse(),
    ApiStandardForbiddenResponse('Member access is outside actor scope'),
    ApiStandardNotFoundResponse('Member was not found'),
    ApiStandardConflictResponse('Member request conflicts with current data'),
  );
}

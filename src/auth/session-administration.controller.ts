import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../common/security/access-token.guard';
import { AuthenticationGuard } from '../common/security/authentication.guard';
import { FinalPermissions } from '../common/security/final-permissions.decorator';
import { FinalPermissionsGuard } from '../common/security/final-permissions.guard';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import {
  ApiStandardBadRequestResponse,
  ApiStandardForbiddenResponse,
  ApiStandardNotFoundResponse,
  ApiStandardUnauthorizedResponse,
} from '../common/decorators/api-standard-response.decorator';
import { SessionAdministrationService } from './session-administration.service';
import { PermissionCode } from '../generated/prisma/client';

@ApiTags('auth')
@ApiSecurity('bearer')
@Controller('auth/users')
@UseGuards(
  AccessTokenGuard,
  TenantContextGuard,
  AuthenticationGuard,
  FinalPermissionsGuard,
)
@ApiStandardBadRequestResponse()
@ApiStandardUnauthorizedResponse()
@ApiStandardForbiddenResponse()
export class SessionAdministrationController {
  constructor(private readonly service: SessionAdministrationService) {}

  @Delete(':userId/sessions')
  @FinalPermissions(PermissionCode.REVOKE_USER_SESSIONS)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke all sessions of a User in this Tenant' })
  @ApiNoContentResponse({ description: 'Sessions revoked (idempotent)' })
  @ApiStandardNotFoundResponse('User was not found')
  revoke(@Param('userId', ParseUUIDPipe) userId: string): Promise<void> {
    return this.service.revokeForUser(userId);
  }
}

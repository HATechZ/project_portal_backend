import {
  Body,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation } from '@nestjs/swagger';
import { ApiStandardOkResponse } from '../common/decorators/api-standard-response.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { ActiveUser } from '../common/security/active-user.decorator';
import { FinalPermissions } from '../common/security/final-permissions.decorator';
import type { SessionUser } from '../common/security/session.types';
import { PermissionCode } from '../generated/prisma/client';
import { ClientApiController } from './client-api.decorator';
import { ClientContactService } from './client-contact.service';
import {
  ClientPortalAccessResponseDto,
  GrantClientPortalAccessDto,
} from './dtos';

@ClientApiController()
export class ClientPortalAccessController {
  constructor(private readonly service: ClientContactService) {}

  @Put(':clientId/contact/:contactId/portal-access')
  @FinalPermissions(PermissionCode.GRANT_CLIENT_PORTAL_ACCESS)
  @ResponseMessage('Client portal access granted successfully')
  @ApiOperation({ summary: 'Grant Client Portal Access' })
  @ApiStandardOkResponse(
    ClientPortalAccessResponseDto,
    'Client portal access granted',
  )
  grantPortalAccess(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() input: GrantClientPortalAccessDto,
    @ActiveUser() user: SessionUser,
  ) {
    return this.service.grantPortalAccess(
      clientId,
      contactId,
      user.id,
      input.roleId,
    );
  }

  @Delete(':clientId/contact/:contactId/portal-access')
  @HttpCode(204)
  @FinalPermissions(PermissionCode.REVOKE_CLIENT_PORTAL_ACCESS)
  @ResponseMessage('Client portal access revoked successfully')
  @ApiOperation({ summary: 'Revoke Client Portal Access' })
  @ApiNoContentResponse({ description: 'Client portal access revoked' })
  revokePortalAccess(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    return this.service.revokePortalAccess(clientId, contactId);
  }
}

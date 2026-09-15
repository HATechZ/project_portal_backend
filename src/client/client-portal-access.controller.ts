import { Delete, HttpCode, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation } from '@nestjs/swagger';
import { ApiStandardOkResponse } from '../common/decorators/api-standard-response.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { ActiveUser } from '../common/security/active-user.decorator';
import { Permissions } from '../common/security/permissions.decorator';
import type { SessionUser } from '../common/security/session.types';
import { WorkflowActionCode } from '../generated/prisma/client';
import { ClientApiController } from './client-api.decorator';
import { ClientContactService } from './client-contact.service';
import { ClientPortalAccessResponseDto } from './dtos';

@ClientApiController()
export class ClientPortalAccessController {
  constructor(private readonly service: ClientContactService) {}

  @Put(':clientId/contact/:contactId/portal-access')
  @Permissions(WorkflowActionCode.MANAGE_CLIENT_PORTAL_ACCESS)
  @ResponseMessage('Client portal access granted successfully')
  @ApiOperation({ summary: 'Grant Client Portal Access' })
  @ApiStandardOkResponse(
    ClientPortalAccessResponseDto,
    'Client portal access granted',
  )
  grantPortalAccess(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @ActiveUser() user: SessionUser,
  ) {
    return this.service.grantPortalAccess(clientId, contactId, user.id);
  }

  @Delete(':clientId/contact/:contactId/portal-access')
  @HttpCode(204)
  @Permissions(WorkflowActionCode.MANAGE_CLIENT_PORTAL_ACCESS)
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

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiParam, ApiSecurity, ApiTags } from '@nestjs/swagger';
import {
  ApiStandardBadRequestResponse,
  ApiStandardConflictResponse,
  ApiStandardCreatedResponse,
  ApiStandardForbiddenResponse,
  ApiStandardNotFoundResponse,
  ApiStandardOkResponse,
  ApiStandardUnauthorizedResponse,
} from '../common/decorators/api-standard-response.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { PaginationQueryDto } from '../common/pagination/dtos/pagination-query.dto';
import { AccessTokenGuard } from '../common/security/access-token.guard';
import { ActiveUser } from '../common/security/active-user.decorator';
import { AuthenticationGuard } from '../common/security/authentication.guard';
import { ObjectScopeGuard } from '../common/security/object-scope.guard';
import { Permissions } from '../common/security/permissions.decorator';
import { PermissionsGuard } from '../common/security/permissions.guard';
import { SystemAdminGuard } from '../common/security/system-admin.guard';
import type { SessionUser } from '../common/security/session.types';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { ApiPaginatedResponse } from '../common/swagger/api-paginated-response.decorator';
import { WorkflowActionCode } from '../generated/prisma/client';
import { ClientService } from './client.service';
import {
  ClientContactResponseDto,
  ClientPortalAccessResponseDto,
  ClientResponseDto,
  CreateClientContactDto,
  CreateClientDto,
  UpdateClientContactDto,
  UpdateClientDto,
} from './dtos';

@ApiTags('client')
@ApiSecurity('bearer')
@Controller('client')
@UseGuards(
  AccessTokenGuard,
  TenantContextGuard,
  AuthenticationGuard,
  ObjectScopeGuard,
  SystemAdminGuard,
  PermissionsGuard,
)
@ApiStandardBadRequestResponse()
@ApiStandardUnauthorizedResponse()
@ApiStandardForbiddenResponse('System administrator access required')
@ApiStandardNotFoundResponse('Client was not found')
@ApiStandardConflictResponse('Client request conflicts with current data')
export class ClientController {
  constructor(private readonly service: ClientService) {}

  @Post()
  @Permissions(WorkflowActionCode.MANAGE_CLIENT)
  @ResponseMessage('Client created successfully')
  @ApiOperation({ summary: 'Create Client' })
  @ApiStandardCreatedResponse(ClientResponseDto, 'Client created')
  create(@Body() input: CreateClientDto, @ActiveUser() user: SessionUser) {
    return this.service.create(input, user.id);
  }

  @Get()
  @Permissions(WorkflowActionCode.MANAGE_CLIENT)
  @ResponseMessage('Clients returned successfully')
  @ApiOperation({ summary: 'List Clients' })
  @ApiPaginatedResponse(ClientResponseDto)
  findAll(@Query() query: PaginationQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':clientId')
  @Permissions(WorkflowActionCode.MANAGE_CLIENT)
  @ResponseMessage('Client returned successfully')
  @ApiOperation({ summary: 'Get Client' })
  @ApiParam({ name: 'clientId', format: 'uuid' })
  @ApiStandardOkResponse(ClientResponseDto, 'Client returned')
  findOne(@Param('clientId', ParseUUIDPipe) clientId: string) {
    return this.service.findOne(clientId);
  }

  @Patch(':clientId')
  @Permissions(WorkflowActionCode.MANAGE_CLIENT)
  @ResponseMessage('Client updated successfully')
  @ApiOperation({ summary: 'Update Client' })
  @ApiParam({ name: 'clientId', format: 'uuid' })
  @ApiStandardOkResponse(ClientResponseDto, 'Client updated')
  update(@Param('clientId', ParseUUIDPipe) clientId: string, @Body() input: UpdateClientDto) {
    return this.service.update(clientId, input);
  }

  @Patch(':clientId/deactivate')
  @Permissions(WorkflowActionCode.MANAGE_CLIENT)
  @ResponseMessage('Client deactivated successfully')
  @ApiOperation({ summary: 'Deactivate Client' })
  @ApiStandardOkResponse(ClientResponseDto, 'Client deactivated')
  deactivate(@Param('clientId', ParseUUIDPipe) clientId: string) {
    return this.service.deactivate(clientId);
  }

  @Patch(':clientId/reactivate')
  @Permissions(WorkflowActionCode.MANAGE_CLIENT)
  @ResponseMessage('Client reactivated successfully')
  @ApiOperation({ summary: 'Reactivate Client' })
  @ApiStandardOkResponse(ClientResponseDto, 'Client reactivated')
  reactivate(@Param('clientId', ParseUUIDPipe) clientId: string) {
    return this.service.reactivate(clientId);
  }

  @Post(':clientId/contact')
  @Permissions(WorkflowActionCode.MANAGE_CLIENT_CONTACT)
  @ResponseMessage('Client contact created successfully')
  @ApiOperation({ summary: 'Add Client Contact' })
  @ApiStandardCreatedResponse(ClientContactResponseDto, 'Client contact created')
  addContact(@Param('clientId', ParseUUIDPipe) clientId: string, @Body() input: CreateClientContactDto) {
    return this.service.addContact(clientId, input);
  }

  @Get(':clientId/contact')
  @Permissions(WorkflowActionCode.MANAGE_CLIENT_CONTACT)
  @ResponseMessage('Client contacts returned successfully')
  @ApiOperation({ summary: 'List Client Contacts' })
  @ApiPaginatedResponse(ClientContactResponseDto)
  findContacts(@Param('clientId', ParseUUIDPipe) clientId: string, @Query() query: PaginationQueryDto) {
    return this.service.findContacts(clientId, query);
  }

  @Get(':clientId/contact/:contactId')
  @Permissions(WorkflowActionCode.MANAGE_CLIENT_CONTACT)
  @ResponseMessage('Client contact returned successfully')
  @ApiOperation({ summary: 'Get Client Contact' })
  @ApiStandardOkResponse(ClientContactResponseDto, 'Client contact returned')
  findContact(@Param('clientId', ParseUUIDPipe) clientId: string, @Param('contactId', ParseUUIDPipe) contactId: string) {
    return this.service.findContact(clientId, contactId);
  }

  @Patch(':clientId/contact/:contactId')
  @Permissions(WorkflowActionCode.MANAGE_CLIENT_CONTACT)
  @ResponseMessage('Client contact updated successfully')
  @ApiOperation({ summary: 'Update Client Contact' })
  @ApiStandardOkResponse(ClientContactResponseDto, 'Client contact updated')
  updateContact(@Param('clientId', ParseUUIDPipe) clientId: string, @Param('contactId', ParseUUIDPipe) contactId: string, @Body() input: UpdateClientContactDto) {
    return this.service.updateContact(clientId, contactId, input);
  }

  @Patch(':clientId/contact/:contactId/deactivate')
  @Permissions(WorkflowActionCode.MANAGE_CLIENT_CONTACT)
  @ResponseMessage('Client contact deactivated successfully')
  @ApiOperation({ summary: 'Deactivate Client Contact' })
  @ApiStandardOkResponse(ClientContactResponseDto, 'Client contact deactivated')
  deactivateContact(@Param('clientId', ParseUUIDPipe) clientId: string, @Param('contactId', ParseUUIDPipe) contactId: string) {
    return this.service.deactivateContact(clientId, contactId);
  }

  @Patch(':clientId/contact/:contactId/reactivate')
  @Permissions(WorkflowActionCode.MANAGE_CLIENT_CONTACT)
  @ResponseMessage('Client contact reactivated successfully')
  @ApiOperation({ summary: 'Reactivate Client Contact' })
  @ApiStandardOkResponse(ClientContactResponseDto, 'Client contact reactivated')
  reactivateContact(@Param('clientId', ParseUUIDPipe) clientId: string, @Param('contactId', ParseUUIDPipe) contactId: string) {
    return this.service.reactivateContact(clientId, contactId);
  }

  @Patch(':clientId/contact/:contactId/primary')
  @Permissions(WorkflowActionCode.MANAGE_CLIENT_CONTACT)
  @ResponseMessage('Primary Client contact updated successfully')
  @ApiOperation({ summary: 'Set Primary Client Contact' })
  @ApiStandardOkResponse(ClientContactResponseDto, 'Primary Client contact updated')
  setPrimary(@Param('clientId', ParseUUIDPipe) clientId: string, @Param('contactId', ParseUUIDPipe) contactId: string) {
    return this.service.setPrimary(clientId, contactId);
  }

  @Put(':clientId/contact/:contactId/portal-access')
  @Permissions(WorkflowActionCode.MANAGE_CLIENT_PORTAL_ACCESS)
  @ResponseMessage('Client portal access granted successfully')
  @ApiOperation({ summary: 'Grant Client Portal Access' })
  @ApiStandardOkResponse(ClientPortalAccessResponseDto, 'Client portal access granted')
  grantPortalAccess(@Param('clientId', ParseUUIDPipe) clientId: string, @Param('contactId', ParseUUIDPipe) contactId: string, @ActiveUser() user: SessionUser) {
    return this.service.grantPortalAccess(clientId, contactId, user.id);
  }

  @Delete(':clientId/contact/:contactId/portal-access')
  @HttpCode(204)
  @Permissions(WorkflowActionCode.MANAGE_CLIENT_PORTAL_ACCESS)
  @ResponseMessage('Client portal access revoked successfully')
  @ApiOperation({ summary: 'Revoke Client Portal Access' })
  @ApiNoContentResponse({ description: 'Client portal access revoked' })
  revokePortalAccess(@Param('clientId', ParseUUIDPipe) clientId: string, @Param('contactId', ParseUUIDPipe) contactId: string) {
    return this.service.revokePortalAccess(clientId, contactId);
  }
}

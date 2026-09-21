import {
  Body,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import {
  ApiStandardCreatedResponse,
  ApiStandardOkResponse,
} from '../common/decorators/api-standard-response.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { PaginationQueryDto } from '../common/pagination/dtos/pagination-query.dto';
import { Permissions } from '../common/security/permissions.decorator';
import { ApiPaginatedResponse } from '../common/swagger/api-paginated-response.decorator';
import { WorkflowActionCode } from '../generated/prisma/client';
import { ClientApiController } from './client-api.decorator';
import { ClientContactService } from './client-contact.service';
import {
  ClientContactResponseDto,
  CreateClientContactDto,
  UpdateClientContactDto,
} from './dtos';

@ClientApiController()
export class ClientContactController {
  constructor(private readonly service: ClientContactService) {}

  @Post(':clientId/contact')
  @Permissions(WorkflowActionCode.MANAGE_CLIENT_CONTACT)
  @ResponseMessage('Client contact created successfully')
  @ApiOperation({ summary: 'Add Client Contact' })
  @ApiStandardCreatedResponse(
    ClientContactResponseDto,
    'Client contact created',
  )
  addContact(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() input: CreateClientContactDto,
  ) {
    return this.service.addContact(clientId, input);
  }

  @Get(':clientId/contact')
  @Permissions(WorkflowActionCode.MANAGE_CLIENT_CONTACT)
  @ResponseMessage('Client contacts returned successfully')
  @ApiOperation({ summary: 'List Client Contacts' })
  @ApiPaginatedResponse(ClientContactResponseDto)
  findContacts(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.service.findContacts(clientId, query);
  }

  @Get(':clientId/contact/deactivated')
  @Permissions(WorkflowActionCode.MANAGE_CLIENT_CONTACT)
  @ResponseMessage('Deactivated client contacts returned successfully')
  @ApiOperation({ summary: 'List deactivated Client Contacts' })
  @ApiPaginatedResponse(ClientContactResponseDto)
  findDeactivatedContacts(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.service.findDeactivatedContacts(clientId, query);
  }

  @Get(':clientId/contact/:contactId')
  @Permissions(WorkflowActionCode.MANAGE_CLIENT_CONTACT)
  @ResponseMessage('Client contact returned successfully')
  @ApiOperation({ summary: 'Get Client Contact' })
  @ApiStandardOkResponse(ClientContactResponseDto, 'Client contact returned')
  findContact(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    return this.service.findContact(clientId, contactId);
  }

  @Patch(':clientId/contact/:contactId')
  @Permissions(WorkflowActionCode.MANAGE_CLIENT_CONTACT)
  @ResponseMessage('Client contact updated successfully')
  @ApiOperation({ summary: 'Update Client Contact' })
  @ApiStandardOkResponse(ClientContactResponseDto, 'Client contact updated')
  updateContact(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() input: UpdateClientContactDto,
  ) {
    return this.service.updateContact(clientId, contactId, input);
  }

  @Patch(':clientId/contact/:contactId/deactivate')
  @Permissions(WorkflowActionCode.MANAGE_CLIENT_CONTACT)
  @ResponseMessage('Client contact deactivated successfully')
  @ApiOperation({ summary: 'Deactivate Client Contact' })
  @ApiStandardOkResponse(ClientContactResponseDto, 'Client contact deactivated')
  deactivateContact(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    return this.service.deactivateContact(clientId, contactId);
  }

  @Patch(':clientId/contact/:contactId/reactivate')
  @Permissions(WorkflowActionCode.MANAGE_CLIENT_CONTACT)
  @ResponseMessage('Client contact reactivated successfully')
  @ApiOperation({ summary: 'Reactivate Client Contact' })
  @ApiStandardOkResponse(ClientContactResponseDto, 'Client contact reactivated')
  reactivateContact(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    return this.service.reactivateContact(clientId, contactId);
  }

  @Patch(':clientId/contact/:contactId/primary')
  @Permissions(WorkflowActionCode.MANAGE_CLIENT_CONTACT)
  @ResponseMessage('Primary Client contact updated successfully')
  @ApiOperation({ summary: 'Set Primary Client Contact' })
  @ApiStandardOkResponse(
    ClientContactResponseDto,
    'Primary Client contact updated',
  )
  setPrimary(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    return this.service.setPrimary(clientId, contactId);
  }
}

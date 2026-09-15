import {
  Body,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam } from '@nestjs/swagger';
import {
  ApiStandardCreatedResponse,
  ApiStandardOkResponse,
} from '../common/decorators/api-standard-response.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { PaginationQueryDto } from '../common/pagination/dtos/pagination-query.dto';
import { ActiveUser } from '../common/security/active-user.decorator';
import { Permissions } from '../common/security/permissions.decorator';
import type { SessionUser } from '../common/security/session.types';
import { ApiPaginatedResponse } from '../common/swagger/api-paginated-response.decorator';
import { WorkflowActionCode } from '../generated/prisma/client';
import { ClientApiController } from './client-api.decorator';
import { ClientService } from './client.service';
import { ClientResponseDto, CreateClientDto, UpdateClientDto } from './dtos';

@ClientApiController()
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
  update(
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() input: UpdateClientDto,
  ) {
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
}

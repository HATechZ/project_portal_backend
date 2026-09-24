import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiSecurity, ApiTags } from '@nestjs/swagger';
import {
  ApiStandardArrayResponse,
  ApiStandardBadRequestResponse,
  ApiStandardConflictResponse,
  ApiStandardCreatedResponse,
  ApiStandardForbiddenResponse,
  ApiStandardNotFoundResponse,
  ApiStandardOkResponse,
  ApiStandardUnauthorizedResponse,
} from '../common/decorators/api-standard-response.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { AccessTokenGuard } from '../common/security/access-token.guard';
import { AuthenticationGuard } from '../common/security/authentication.guard';
import { ObjectScopeGuard } from '../common/security/object-scope.guard';
import { Permissions } from '../common/security/permissions.decorator';
import { PermissionsGuard } from '../common/security/permissions.guard';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { WorkflowActionCode } from '../generated/prisma/client';
import {
  PmOperationDocumentCodeInputDto,
  PmOperationDocumentCodeQueryDto,
  PmOperationDocumentCodeResponseDto,
  UpdatePmOperationDocumentCodeDto,
} from './dtos/pm-operation-code.dto';
import { PmOperationDocumentCodeService } from './pm-operation-code.service';

@ApiTags('PM & Operation Document Codes')
@ApiSecurity('bearer')
@Controller('project-management-operation-document-codes')
@UseGuards(
  AccessTokenGuard,
  TenantContextGuard,
  AuthenticationGuard,
  ObjectScopeGuard,
  PermissionsGuard,
)
@Permissions(WorkflowActionCode.MANAGE_GENERAL_DOCUMENT_CODES)
@ApiStandardBadRequestResponse()
@ApiStandardUnauthorizedResponse()
@ApiStandardForbiddenResponse()
export class PmOperationDocumentCodeController {
  constructor(private readonly service: PmOperationDocumentCodeService) {}

  @Get()
  @ApiOperation({ summary: 'List all PM & Operation Document Codes' })
  @ResponseMessage('PM & Operation Document Codes returned successfully')
  @ApiStandardArrayResponse(
    PmOperationDocumentCodeResponseDto,
    'PM & Operation Document Codes returned',
  )
  findAll(@Query() query: PmOperationDocumentCodeQueryDto) {
    return this.service.findAll(query.status);
  }

  @Get('deactivated')
  @ApiOperation({ summary: 'List deactivated PM & Operation Document Codes' })
  @ResponseMessage('Deactivated PM & Operation Document Codes returned successfully')
  @ApiStandardArrayResponse(
    PmOperationDocumentCodeResponseDto,
    'Deactivated PM & Operation Document Codes returned',
  )
  findDeactivated() {
    return this.service.findDeactivated();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get PM & Operation Document Code by ID' })
  @ApiParam({ name: 'id', description: 'PM & Operation Document Code ID' })
  @ResponseMessage('PM & Operation Document Code returned successfully')
  @ApiStandardOkResponse(
    PmOperationDocumentCodeResponseDto,
    'PM & Operation Document Code returned',
  )
  @ApiStandardNotFoundResponse('PM & Operation Document Code was not found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new PM & Operation Document Code' })
  @ResponseMessage('PM & Operation Document Code created successfully')
  @ApiStandardCreatedResponse(
    PmOperationDocumentCodeResponseDto,
    'PM & Operation Document Code created',
  )
  @ApiStandardConflictResponse(
    'An PM & Operation Document Code with the same code already exists',
  )
  create(@Body() input: PmOperationDocumentCodeInputDto) {
    return this.service.create(input);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update PM & Operation Document Code by ID' })
  @ApiParam({ name: 'id', description: 'PM & Operation Document Code ID' })
  @ResponseMessage('PM & Operation Document Code updated successfully')
  @ApiStandardOkResponse(
    PmOperationDocumentCodeResponseDto,
    'PM & Operation Document Code updated',
  )
  @ApiStandardNotFoundResponse('PM & Operation Document Code was not found')
  @ApiStandardConflictResponse(
    'PM & Operation Document Code update conflicts with its current state',
  )
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdatePmOperationDocumentCodeDto,
  ) {
    return this.service.update(id, input);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate PM & Operation Document Code by ID' })
  @ApiParam({ name: 'id', description: 'PM & Operation Document Code ID' })
  @ResponseMessage('PM & Operation Document Code deactivated successfully')
  @ApiStandardOkResponse(
    PmOperationDocumentCodeResponseDto,
    'PM & Operation Document Code deactivated',
  )
  @ApiStandardNotFoundResponse('PM & Operation Document Code was not found')
  @ApiStandardConflictResponse('PM & Operation Document Code is already inactive')
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deactivate(id);
  }

  @Patch(':id/reactivate')
  @ApiOperation({ summary: 'Reactivate PM & Operation Document Code by ID' })
  @ApiParam({ name: 'id', description: 'PM & Operation Document Code ID' })
  @ResponseMessage('PM & Operation Document Code reactivated successfully')
  @ApiStandardOkResponse(
    PmOperationDocumentCodeResponseDto,
    'PM & Operation Document Code reactivated',
  )
  @ApiStandardNotFoundResponse('PM & Operation Document Code was not found')
  @ApiStandardConflictResponse('PM & Operation Document Code is already active')
  reactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.reactivate(id);
  }
}





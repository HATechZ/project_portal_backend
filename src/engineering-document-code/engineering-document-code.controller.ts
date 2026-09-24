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
  EngineeringDocumentCodeInputDto,
  EngineeringDocumentCodeQueryDto,
  EngineeringDocumentCodeResponseDto,
  UpdateEngineeringDocumentCodeDto,
} from './dtos/engineering-document-code.dto';
import { EngineeringDocumentCodeService } from './engineering-document-code.service';

@ApiTags('Engineering Document Codes')
@ApiSecurity('bearer')
@Controller('engineering-document-codes')
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
export class EngineeringDocumentCodeController {
  constructor(private readonly service: EngineeringDocumentCodeService) {}

  @Get()
  @ApiOperation({ summary: 'List all Engineering Document Codes' })
  @ResponseMessage('Engineering Document Codes returned successfully')
  @ApiStandardArrayResponse(
    EngineeringDocumentCodeResponseDto,
    'Engineering Document Codes returned',
  )
  findAll(@Query() query: EngineeringDocumentCodeQueryDto) {
    return this.service.findAll(query.status);
  }

  @Get('deactivated')
  @ApiOperation({ summary: 'List deactivated Engineering Document Codes' })
  @ResponseMessage(
    'Deactivated Engineering Document Codes returned successfully',
  )
  @ApiStandardArrayResponse(
    EngineeringDocumentCodeResponseDto,
    'Deactivated Engineering Document Codes returned',
  )
  findDeactivated() {
    return this.service.findDeactivated();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Engineering Document Code by ID' })
  @ApiParam({ name: 'id', description: 'Engineering Document Code ID' })
  @ResponseMessage('Engineering Document Code returned successfully')
  @ApiStandardOkResponse(
    EngineeringDocumentCodeResponseDto,
    'Engineering Document Code returned',
  )
  @ApiStandardNotFoundResponse('Engineering Document Code was not found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new Engineering Document Code' })
  @ResponseMessage('Engineering Document Code created successfully')
  @ApiStandardCreatedResponse(
    EngineeringDocumentCodeResponseDto,
    'Engineering Document Code created',
  )
  @ApiStandardConflictResponse(
    'An Engineering Document Code with the same code already exists',
  )
  create(@Body() input: EngineeringDocumentCodeInputDto) {
    return this.service.create(input);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Engineering Document Code by ID' })
  @ApiParam({ name: 'id', description: 'Engineering Document Code ID' })
  @ResponseMessage('Engineering Document Code updated successfully')
  @ApiStandardOkResponse(
    EngineeringDocumentCodeResponseDto,
    'Engineering Document Code updated',
  )
  @ApiStandardNotFoundResponse('Engineering Document Code was not found')
  @ApiStandardConflictResponse(
    'Engineering Document Code update conflicts with its current state',
  )
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateEngineeringDocumentCodeDto,
  ) {
    return this.service.update(id, input);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate Engineering Document Code by ID' })
  @ApiParam({ name: 'id', description: 'Engineering Document Code ID' })
  @ResponseMessage('Engineering Document Code deactivated successfully')
  @ApiStandardOkResponse(
    EngineeringDocumentCodeResponseDto,
    'Engineering Document Code deactivated',
  )
  @ApiStandardNotFoundResponse('Engineering Document Code was not found')
  @ApiStandardConflictResponse('Engineering Document Code is already inactive')
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deactivate(id);
  }

  @Patch(':id/reactivate')
  @ApiOperation({ summary: 'Reactivate Engineering Document Code by ID' })
  @ApiParam({ name: 'id', description: 'Engineering Document Code ID' })
  @ResponseMessage('Engineering Document Code reactivated successfully')
  @ApiStandardOkResponse(
    EngineeringDocumentCodeResponseDto,
    'Engineering Document Code reactivated',
  )
  @ApiStandardNotFoundResponse('Engineering Document Code was not found')
  @ApiStandardConflictResponse('Engineering Document Code is already active')
  reactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.reactivate(id);
  }
}

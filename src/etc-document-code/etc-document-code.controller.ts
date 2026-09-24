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
  EtcDocumentCodeInputDto,
  EtcDocumentCodeQueryDto,
  EtcDocumentCodeResponseDto,
  UpdateEtcDocumentCodeDto,
} from './dtos/etc-document-code.dto';
import { EtcDocumentCodeService } from './etc-document-code.service';

@ApiTags('ETC Document Codes')
@ApiSecurity('bearer')
@Controller('etc-document-codes')
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
export class EtcDocumentCodeController {
  constructor(private readonly service: EtcDocumentCodeService) {}

  @Get()
  @ApiOperation({ summary: 'List all ETC Document Codes' })
  @ResponseMessage('ETC Document Codes returned successfully')
  @ApiStandardArrayResponse(
    EtcDocumentCodeResponseDto,
    'ETC Document Codes returned',
  )
  findAll(@Query() query: EtcDocumentCodeQueryDto) {
    return this.service.findAll(query.status);
  }

  @Get('deactivated')
  @ApiOperation({ summary: 'List deactivated ETC Document Codes' })
  @ResponseMessage('Deactivated ETC Document Codes returned successfully')
  @ApiStandardArrayResponse(
    EtcDocumentCodeResponseDto,
    'Deactivated ETC Document Codes returned',
  )
  findDeactivated() {
    return this.service.findDeactivated();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ETC Document Code by ID' })
  @ApiParam({ name: 'id', description: 'ETC Document Code ID' })
  @ResponseMessage('ETC Document Code returned successfully')
  @ApiStandardOkResponse(
    EtcDocumentCodeResponseDto,
    'ETC Document Code returned',
  )
  @ApiStandardNotFoundResponse('ETC Document Code was not found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new ETC Document Code' })
  @ResponseMessage('ETC Document Code created successfully')
  @ApiStandardCreatedResponse(
    EtcDocumentCodeResponseDto,
    'ETC Document Code created',
  )
  @ApiStandardConflictResponse(
    'An ETC Document Code with the same code already exists',
  )
  create(@Body() input: EtcDocumentCodeInputDto) {
    return this.service.create(input);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update ETC Document Code by ID' })
  @ApiParam({ name: 'id', description: 'ETC Document Code ID' })
  @ResponseMessage('ETC Document Code updated successfully')
  @ApiStandardOkResponse(
    EtcDocumentCodeResponseDto,
    'ETC Document Code updated',
  )
  @ApiStandardNotFoundResponse('ETC Document Code was not found')
  @ApiStandardConflictResponse(
    'ETC Document Code update conflicts with its current state',
  )
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateEtcDocumentCodeDto,
  ) {
    return this.service.update(id, input);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate ETC Document Code by ID' })
  @ApiParam({ name: 'id', description: 'ETC Document Code ID' })
  @ResponseMessage('ETC Document Code deactivated successfully')
  @ApiStandardOkResponse(
    EtcDocumentCodeResponseDto,
    'ETC Document Code deactivated',
  )
  @ApiStandardNotFoundResponse('ETC Document Code was not found')
  @ApiStandardConflictResponse('ETC Document Code is already inactive')
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deactivate(id);
  }

  @Patch(':id/reactivate')
  @ApiOperation({ summary: 'Reactivate ETC Document Code by ID' })
  @ApiParam({ name: 'id', description: 'ETC Document Code ID' })
  @ResponseMessage('ETC Document Code reactivated successfully')
  @ApiStandardOkResponse(
    EtcDocumentCodeResponseDto,
    'ETC Document Code reactivated',
  )
  @ApiStandardNotFoundResponse('ETC Document Code was not found')
  @ApiStandardConflictResponse('ETC Document Code is already active')
  reactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.reactivate(id);
  }
}

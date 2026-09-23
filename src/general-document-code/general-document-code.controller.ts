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
  GeneralDocumentCodeInputDto,
  GeneralDocumentCodeQueryDto,
  GeneralDocumentCodeResponseDto,
  UpdateGeneralDocumentCodeDto,
} from './dtos/general-document-code.dto';
import { GeneralDocumentCodeService } from './general-document-code.service';

@ApiTags('general-document-codes')
@ApiSecurity('bearer')
@Controller('general-document-codes')
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
export class GeneralDocumentCodeController {
  constructor(private readonly service: GeneralDocumentCodeService) {}

  @Get()
  @ApiOperation({ summary: 'List all General Document Codes' })
  @ResponseMessage('General Document Codes returned successfully')
  @ApiStandardArrayResponse(
    GeneralDocumentCodeResponseDto,
    'General Document Codes returned',
  )
  findAll(@Query() query: GeneralDocumentCodeQueryDto) {
    return this.service.findAll(query.status);
  }

  @Get('deactivated')
  @ApiOperation({ summary: 'List deactivated General Document Codes' })
  @ResponseMessage('Deactivated General Document Codes returned successfully')
  @ApiStandardArrayResponse(
    GeneralDocumentCodeResponseDto,
    'Deactivated General Document Codes returned',
  )
  findDeactivated() {
    return this.service.findDeactivated();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get General Document Code by ID' })
  @ApiParam({
    name: 'id',
    description: 'General Document Code ID',
  })
  @ResponseMessage('General Document Code returned successfully')
  @ApiStandardOkResponse(
    GeneralDocumentCodeResponseDto,
    'General Document Code returned',
  )
  @ApiStandardNotFoundResponse('General Document Code was not found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new General Document Code' })
  @ResponseMessage('General Document Code created successfully')
  @ApiStandardCreatedResponse(
    GeneralDocumentCodeResponseDto,
    'General Document Code created',
  )
  @ApiStandardConflictResponse(
    'A General Document Code with the same code already exists',
  )
  create(@Body() input: GeneralDocumentCodeInputDto) {
    return this.service.create(input);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update General Document Code by ID' })
  @ApiParam({
    name: 'id',
    description: 'General Document Code ID',
  })
  @ResponseMessage('General Document Code updated successfully')
  @ApiStandardOkResponse(
    GeneralDocumentCodeResponseDto,
    'General Document Code updated',
  )
  @ApiStandardNotFoundResponse('General Document Code was not found')
  @ApiStandardConflictResponse(
    'General Document Code update conflicts with its current state',
  )
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateGeneralDocumentCodeDto,
  ) {
    return this.service.update(id, input);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate General Document Code by ID' })
  @ApiParam({
    name: 'id',
    description: 'General Document Code ID',
  })
  @ResponseMessage('General Document Code deactivated successfully')
  @ApiStandardOkResponse(
    GeneralDocumentCodeResponseDto,
    'General Document Code deactivated',
  )
  @ApiStandardNotFoundResponse('General Document Code was not found')
  @ApiStandardConflictResponse('General Document Code is already inactive')
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deactivate(id);
  }

  @Patch(':id/reactivate')
  @ApiOperation({ summary: 'Reactivate General Document Code by ID' })
  @ApiParam({
    name: 'id',
    description: 'General Document Code ID',
  })
  @ResponseMessage('General Document Code reactivated successfully')
  @ApiStandardOkResponse(
    GeneralDocumentCodeResponseDto,
    'General Document Code reactivated',
  )
  @ApiStandardNotFoundResponse('General Document Code was not found')
  @ApiStandardConflictResponse('General Document Code is already active')
  reactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.reactivate(id);
  }
}

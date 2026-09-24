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
  MarketingDocumentCodeInputDto,
  MarketingDocumentCodeQueryDto,
  MarketingDocumentCodeResponseDto,
  UpdateMarketingDocumentCodeDto,
} from './dtos/marketing-document-code.dto';
import { MarketingDocumentCodeService } from './marketing-document-code.service';

@ApiTags('Marketing Document Codes')
@ApiSecurity('bearer')
@Controller('marketing-document-codes')
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
export class MarketingDocumentCodeController {
  constructor(private readonly service: MarketingDocumentCodeService) {}

  @Get()
  @ApiOperation({ summary: 'List all Marketing Document Codes' })
  @ResponseMessage('Marketing Document Codes returned successfully')
  @ApiStandardArrayResponse(
    MarketingDocumentCodeResponseDto,
    'Marketing Document Codes returned',
  )
  findAll(@Query() query: MarketingDocumentCodeQueryDto) {
    return this.service.findAll(query.status);
  }

  @Get('deactivated')
  @ApiOperation({ summary: 'List deactivated Marketing Document Codes' })
  @ResponseMessage('Deactivated Marketing Document Codes returned successfully')
  @ApiStandardArrayResponse(
    MarketingDocumentCodeResponseDto,
    'Deactivated Marketing Document Codes returned',
  )
  findDeactivated() {
    return this.service.findDeactivated();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Marketing Document Code by ID' })
  @ApiParam({
    name: 'id',
    description: 'Marketing Document Code ID',
  })
  @ResponseMessage('Marketing Document Code returned successfully')
  @ApiStandardOkResponse(
    MarketingDocumentCodeResponseDto,
    'Marketing Document Code returned',
  )
  @ApiStandardNotFoundResponse('Marketing Document Code was not found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new Marketing Document Code' })
  @ResponseMessage('Marketing Document Code created successfully')
  @ApiStandardCreatedResponse(
    MarketingDocumentCodeResponseDto,
    'Marketing Document Code created',
  )
  @ApiStandardConflictResponse(
    'A Marketing Document Code with the same code already exists',
  )
  create(@Body() input: MarketingDocumentCodeInputDto) {
    return this.service.create(input);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Marketing Document Code by ID' })
  @ApiParam({
    name: 'id',
    description: 'Marketing Document Code ID',
  })
  @ResponseMessage('Marketing Document Code updated successfully')
  @ApiStandardOkResponse(
    MarketingDocumentCodeResponseDto,
    'Marketing Document Code updated',
  )
  @ApiStandardNotFoundResponse('Marketing Document Code was not found')
  @ApiStandardConflictResponse(
    'Marketing Document Code update conflicts with its current state',
  )
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateMarketingDocumentCodeDto,
  ) {
    return this.service.update(id, input);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate Marketing Document Code by ID' })
  @ApiParam({
    name: 'id',
    description: 'Marketing Document Code ID',
  })
  @ResponseMessage('Marketing Document Code deactivated successfully')
  @ApiStandardOkResponse(
    MarketingDocumentCodeResponseDto,
    'Marketing Document Code deactivated',
  )
  @ApiStandardNotFoundResponse('Marketing Document Code was not found')
  @ApiStandardConflictResponse('Marketing Document Code is already inactive')
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deactivate(id);
  }

  @Patch(':id/reactivate')
  @ApiOperation({ summary: 'Reactivate Marketing Document Code by ID' })
  @ApiParam({
    name: 'id',
    description: 'Marketing Document Code ID',
  })
  @ResponseMessage('Marketing Document Code reactivated successfully')
  @ApiStandardOkResponse(
    MarketingDocumentCodeResponseDto,
    'Marketing Document Code reactivated',
  )
  @ApiStandardNotFoundResponse('Marketing Document Code was not found')
  @ApiStandardConflictResponse('Marketing Document Code is already active')
  reactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.reactivate(id);
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { WorkflowActionCode } from '../generated/prisma/client';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token/access-token.guard';
import { AuthenticationGuard } from '../auth/guards/authentication/authentication.guard';
import { ObjectScopeGuard } from '../auth/guards/permissions/object-scope.guard';
import { PermissionsGuard } from '../auth/guards/permissions/permissions.guard';
import { SystemAdminGuard } from '../auth/guards/permissions/system-admin.guard';
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
import { PaginationQueryDto } from '../common/pagination/dtos/pagination-query.dto';
import { ApiPaginatedResponse } from '../common/swagger/api-paginated-response.decorator';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import {
  CompanyResponseDto,
  CompanyTypeResponseDto,
  CreateCompanyDto,
} from './dtos';
import { CompanyService } from './company.service';

@ApiTags('company')
@ApiSecurity({ bearer: [], tenant: [] })
@Controller()
@UseGuards(
  TenantContextGuard,
  AccessTokenGuard,
  AuthenticationGuard,
  ObjectScopeGuard,
  SystemAdminGuard,
  PermissionsGuard,
)
@ApiStandardBadRequestResponse()
@ApiStandardUnauthorizedResponse()
@ApiStandardForbiddenResponse('System administrator access required')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get('company-type')
  @ResponseMessage('Company types returned successfully')
  @ApiOperation({ summary: 'List company type references' })
  @ApiStandardArrayResponse(CompanyTypeResponseDto)
  findCompanyTypes() {
    return this.companyService.findCompanyTypes();
  }

  @Post('company')
  @Permissions(WorkflowActionCode.ADD_COMPANY)
  @ResponseMessage('Company created successfully')
  @ApiOperation({ summary: 'Create a company' })
  @ApiStandardCreatedResponse(CompanyResponseDto, 'Company created')
  @ApiStandardConflictResponse(
    'Company abbreviation is already in use',
    'A company with this abbreviation already exists',
  )
  create(@Body() input: CreateCompanyDto) {
    return this.companyService.create(input);
  }

  @Get('company')
  @ResponseMessage('Companies returned successfully')
  @ApiOperation({ summary: 'List companies' })
  @ApiPaginatedResponse(CompanyResponseDto)
  findAll(@Query() query: PaginationQueryDto) {
    return this.companyService.findAll(query);
  }

  @Get('company/:id')
  @ResponseMessage('Company returned successfully')
  @ApiOperation({ summary: 'Get a company by ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiStandardOkResponse(CompanyResponseDto, 'Company returned')
  @ApiStandardNotFoundResponse(
    'Company was not found',
    'Company with ID 0c10bb48-f0e4-4884-909d-cf6408914290 was not found',
  )
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.companyService.findOne(id);
  }
}

import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../common/security/access-token.guard';
import { AuthenticationGuard } from '../common/security/authentication.guard';
import { ObjectScopeGuard } from '../common/security/object-scope.guard';
import { PermissionsGuard } from '../common/security/permissions.guard';
import { SystemAdminGuard } from '../common/security/system-admin.guard';
import {
  ApiStandardBadRequestResponse,
  ApiStandardForbiddenResponse,
  ApiStandardNotFoundResponse,
  ApiStandardOkResponse,
  ApiStandardUnauthorizedResponse,
} from '../common/decorators/api-standard-response.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { PaginationQueryDto } from '../common/pagination/dtos/pagination-query.dto';
import { ApiPaginatedResponse } from '../common/swagger/api-paginated-response.decorator';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { CompanyResponseDto } from './dtos';
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

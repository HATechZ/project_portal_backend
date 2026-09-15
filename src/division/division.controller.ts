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
import {
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
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
import type { SessionUser } from '../common/security/session.types';
import { Permissions } from '../common/security/permissions.decorator';
import { PermissionsGuard } from '../common/security/permissions.guard';
import { SystemAdminGuard } from '../common/security/system-admin.guard';
import { ApiPaginatedResponse } from '../common/swagger/api-paginated-response.decorator';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { WorkflowActionCode } from '../generated/prisma/client';
import { DivisionService } from './division.service';
import {
  AssignDivisionLeadDto,
  CreateDivisionDto,
  DivisionLeadResponseDto,
  DivisionResponseDto,
  UpdateDivisionDto,
} from './dtos';

@ApiTags('division')
@ApiSecurity('bearer')
@Controller('division')
@UseGuards(
  AccessTokenGuard,
  TenantContextGuard,
  AuthenticationGuard,
  ObjectScopeGuard,
  SystemAdminGuard,
  PermissionsGuard,
)
@Permissions(WorkflowActionCode.ADD_DIVISION)
@ApiStandardBadRequestResponse()
@ApiStandardUnauthorizedResponse()
@ApiStandardForbiddenResponse('System administrator access required')
@ApiStandardNotFoundResponse('Division was not found')
@ApiStandardConflictResponse('Division request conflicts with current data')
export class DivisionController {
  constructor(private readonly divisionService: DivisionService) {}

  @Post()
  @ResponseMessage('Division created successfully')
  @ApiOperation({ summary: 'Create a Division' })
  @ApiStandardCreatedResponse(DivisionResponseDto, 'Division created')
  create(@Body() input: CreateDivisionDto) {
    return this.divisionService.create(input);
  }

  @Get()
  @ResponseMessage('Divisions returned successfully')
  @ApiOperation({ summary: 'List Divisions' })
  @ApiPaginatedResponse(DivisionResponseDto)
  findAll(@Query() query: PaginationQueryDto) {
    return this.divisionService.findAll(query);
  }

  @Get(':id')
  @ResponseMessage('Division returned successfully')
  @ApiOperation({ summary: 'Get a Division by ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiStandardOkResponse(DivisionResponseDto, 'Division returned')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.divisionService.findOne(id);
  }

  @Patch(':id')
  @ResponseMessage('Division updated successfully')
  @ApiOperation({ summary: 'Update a Division' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiStandardOkResponse(DivisionResponseDto, 'Division updated')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateDivisionDto,
  ) {
    return this.divisionService.update(id, input);
  }

  @Put(':id/lead')
  @ResponseMessage('Division Lead assigned successfully')
  @ApiOperation({
    summary: 'Assign Division Lead',
    description:
      'Assign an eligible Member of this Division as Division Lead. System Admin only.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiStandardOkResponse(DivisionLeadResponseDto, 'Division Lead assigned')
  assignLead(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AssignDivisionLeadDto,
    @ActiveUser() activeUser: SessionUser,
  ) {
    return this.divisionService.assignLead(id, input, activeUser.id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ResponseMessage('Division deleted successfully')
  @ApiOperation({ summary: 'Delete a Division' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiNoContentResponse({ description: 'Division deleted' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.divisionService.delete(id);
  }
}

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
import { ApiPaginatedResponse } from '../common/swagger/api-paginated-response.decorator';
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
import { AuthenticationGuard } from '../common/security/authentication.guard';
import { ObjectScopeGuard } from '../common/security/object-scope.guard';
import { Permissions } from '../common/security/permissions.decorator';
import { PermissionsGuard } from '../common/security/permissions.guard';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { WorkflowActionCode } from '../generated/prisma/client';
import {
  CreateDesignationDto,
  DesignationResponseDto,
  UpdateDesignationDto,
} from './dtos';
import { DesignationService } from './designation.service';

@ApiTags('designations')
@ApiSecurity('bearer')
@Controller('designations')
@UseGuards(
  AccessTokenGuard,
  TenantContextGuard,
  AuthenticationGuard,
  ObjectScopeGuard,
  PermissionsGuard,
)
@ApiStandardBadRequestResponse()
@ApiStandardUnauthorizedResponse()
@ApiStandardForbiddenResponse()
@ApiStandardNotFoundResponse('Designation was not found')
@ApiStandardConflictResponse('Designation request conflicts with current data')
export class DesignationController {
  constructor(private readonly service: DesignationService) {}

  @Get()
  @ResponseMessage('Designations returned successfully')
  @ApiOperation({ summary: 'List Designations' })
  @ApiPaginatedResponse(DesignationResponseDto)
  findAll(@Query() query: PaginationQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ResponseMessage('Designation returned successfully')
  @ApiOperation({ summary: 'Get a Designation by ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiStandardOkResponse(DesignationResponseDto, 'Designation returned')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Permissions(WorkflowActionCode.MANAGE_DESIGNATIONS)
  @ResponseMessage('Designation created successfully')
  @ApiOperation({ summary: 'Create a Designation' })
  @ApiStandardCreatedResponse(DesignationResponseDto, 'Designation created')
  create(@Body() input: CreateDesignationDto) {
    return this.service.create(input);
  }

  @Patch(':id')
  @Permissions(WorkflowActionCode.MANAGE_DESIGNATIONS)
  @ResponseMessage('Designation updated successfully')
  @ApiOperation({ summary: 'Update a Designation' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiStandardOkResponse(DesignationResponseDto, 'Designation updated')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateDesignationDto,
  ) {
    return this.service.update(id, input);
  }

  @Delete(':id')
  @Permissions(WorkflowActionCode.MANAGE_DESIGNATIONS)
  @HttpCode(204)
  @ResponseMessage('Designation deleted successfully')
  @ApiOperation({ summary: 'Delete a Designation' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiNoContentResponse({ description: 'Designation deleted' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.delete(id);
  }
}

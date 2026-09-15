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
  Req,
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
import { ApiPaginatedResponse } from '../common/swagger/api-paginated-response.decorator';
import { AccessTokenGuard } from '../common/security/access-token.guard';
import { AuthenticationGuard } from '../common/security/authentication.guard';
import { ObjectScopeGuard } from '../common/security/object-scope.guard';
import type { ObjectScopeRequest } from '../common/security/object-scope.guard';
import { Permissions } from '../common/security/permissions.decorator';
import { PermissionsGuard } from '../common/security/permissions.guard';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { WorkflowActionCode } from '../generated/prisma/client';
import {
  AssignTeamLeadDto,
  CreateTeamDto,
  TeamQueryDto,
  TeamResponseDto,
  UpdateTeamDto,
} from './dtos';
import { TeamService } from './team.service';

@ApiTags('team')
@ApiSecurity('bearer')
@Controller('team')
@UseGuards(
  AccessTokenGuard,
  TenantContextGuard,
  AuthenticationGuard,
  ObjectScopeGuard,
  PermissionsGuard,
)
@ApiStandardBadRequestResponse()
@ApiStandardUnauthorizedResponse()
@ApiStandardForbiddenResponse('Team access is outside actor scope')
@ApiStandardNotFoundResponse('Team was not found')
@ApiStandardConflictResponse('Team request conflicts with current data')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Post()
  @Permissions(WorkflowActionCode.ADD_TEAM)
  @ResponseMessage('Team created successfully')
  @ApiOperation({ summary: 'Create a Team' })
  @ApiStandardCreatedResponse(TeamResponseDto, 'Team created')
  create(@Body() input: CreateTeamDto, @Req() request: ObjectScopeRequest) {
    return this.teamService.create(input, request.actorScope!);
  }

  @Get()
  @Permissions(WorkflowActionCode.ADD_TEAM)
  @ResponseMessage('Teams returned successfully')
  @ApiOperation({ summary: 'List Teams' })
  @ApiPaginatedResponse(TeamResponseDto)
  findAll(@Query() query: TeamQueryDto, @Req() request: ObjectScopeRequest) {
    return this.teamService.findAll(query, request.actorScope!);
  }

  @Get(':id')
  @Permissions(WorkflowActionCode.ASSIGN_MEMBER)
  @ResponseMessage('Team returned successfully')
  @ApiOperation({ summary: 'Get a Team by ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiStandardOkResponse(TeamResponseDto, 'Team returned')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: ObjectScopeRequest,
  ) {
    return this.teamService.findOne(id, request.actorScope!);
  }

  @Patch(':id')
  @Permissions(WorkflowActionCode.ADD_TEAM)
  @ResponseMessage('Team updated successfully')
  @ApiOperation({ summary: 'Update a Team' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiStandardOkResponse(TeamResponseDto, 'Team updated')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateTeamDto,
    @Req() request: ObjectScopeRequest,
  ) {
    return this.teamService.update(id, input, request.actorScope!);
  }

  @Delete(':id')
  @Permissions(WorkflowActionCode.ADD_TEAM)
  @HttpCode(204)
  @ResponseMessage('Team deleted successfully')
  @ApiOperation({ summary: 'Delete a Team' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiNoContentResponse({ description: 'Team deleted' })
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: ObjectScopeRequest,
  ) {
    return this.teamService.delete(id, request.actorScope!);
  }

  @Put(':id/lead')
  @Permissions(WorkflowActionCode.ADD_TEAM)
  @ResponseMessage('Team lead assigned successfully')
  @ApiOperation({ summary: 'Assign a Team Lead' })
  @ApiStandardOkResponse(TeamResponseDto, 'Team lead assigned')
  assignLead(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AssignTeamLeadDto,
    @Req() request: ObjectScopeRequest,
  ) {
    return this.teamService.assignLead(id, input, request.actorScope!);
  }
}

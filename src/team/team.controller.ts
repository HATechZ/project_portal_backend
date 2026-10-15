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
import { ApiPaginatedResponse } from '../common/swagger/api-paginated-response.decorator';
import { AccessTokenGuard } from '../common/security/access-token.guard';
import { AuthenticationGuard } from '../common/security/authentication.guard';
import { FinalPermissions } from '../common/security/final-permissions.decorator';
import { ActiveActor } from '../common/security/active-actor.decorator';
import type { SessionActor } from '../common/security/session.types';
import { FinalPermissionsGuard } from '../common/security/final-permissions.guard';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { PermissionCode } from '../generated/prisma/client';
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
  FinalPermissionsGuard,
)
@ApiStandardBadRequestResponse()
@ApiStandardUnauthorizedResponse()
@ApiStandardForbiddenResponse('Team access is outside actor scope')
@ApiStandardNotFoundResponse('Team was not found')
@ApiStandardConflictResponse('Team request conflicts with current data')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Post()
  @FinalPermissions(PermissionCode.CREATE_TEAM)
  @ResponseMessage('Team created successfully')
  @ApiOperation({ summary: 'Create a Team' })
  @ApiStandardCreatedResponse(TeamResponseDto, 'Team created')
  create(@Body() input: CreateTeamDto) {
    return this.teamService.create(input);
  }

  @Get()
  @FinalPermissions(PermissionCode.VIEW_TEAMS)
  @ResponseMessage('Teams returned successfully')
  @ApiOperation({ summary: 'List Teams' })
  @ApiPaginatedResponse(TeamResponseDto)
  findAll(@Query() query: TeamQueryDto, @ActiveActor() actor: SessionActor) {
    return this.teamService.findAll(query, actor);
  }

  @Get(':id')
  @FinalPermissions(PermissionCode.VIEW_TEAMS)
  @ResponseMessage('Team returned successfully')
  @ApiOperation({ summary: 'Get a Team by ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiStandardOkResponse(TeamResponseDto, 'Team returned')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.teamService.findOne(id, actor);
  }

  @Patch(':id')
  @FinalPermissions(PermissionCode.UPDATE_TEAM)
  @ResponseMessage('Team updated successfully')
  @ApiOperation({ summary: 'Update a Team' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiStandardOkResponse(TeamResponseDto, 'Team updated')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() input: UpdateTeamDto) {
    return this.teamService.update(id, input);
  }

  @Delete(':id')
  @FinalPermissions(PermissionCode.DELETE_TEAM)
  @HttpCode(204)
  @ResponseMessage('Team deleted successfully')
  @ApiOperation({ summary: 'Delete a Team' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiNoContentResponse({ description: 'Team deleted' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.teamService.delete(id);
  }

  @Put(':id/lead')
  @FinalPermissions(PermissionCode.UPDATE_TEAM)
  @ResponseMessage('Team lead assigned successfully')
  @ApiOperation({ summary: 'Assign a Team Lead' })
  @ApiStandardOkResponse(TeamResponseDto, 'Team lead assigned')
  assignLead(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AssignTeamLeadDto,
  ) {
    return this.teamService.assignLead(id, input);
  }
}

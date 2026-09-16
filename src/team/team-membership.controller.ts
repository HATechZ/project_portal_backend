import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
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
import { AccessTokenGuard } from '../common/security/access-token.guard';
import { AuthenticationGuard } from '../common/security/authentication.guard';
import { ObjectScopeGuard } from '../common/security/object-scope.guard';
import type { ObjectScopeRequest } from '../common/security/object-scope.guard';
import { Permissions } from '../common/security/permissions.decorator';
import { PermissionsGuard } from '../common/security/permissions.guard';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { WorkflowActionCode } from '../generated/prisma/client';
import {
  AddTeamMemberDto,
  TeamMemberQueryDto,
  TeamMemberResponseDto,
} from './dtos';
import { TeamMembershipService } from './team-membership.service';

@ApiTags('team')
@ApiSecurity('bearer')
@Controller('team/:id/member')
@UseGuards(
  AccessTokenGuard,
  TenantContextGuard,
  AuthenticationGuard,
  ObjectScopeGuard,
  PermissionsGuard,
)
@Permissions(WorkflowActionCode.ASSIGN_MEMBER)
@ApiStandardBadRequestResponse()
@ApiStandardUnauthorizedResponse()
@ApiStandardForbiddenResponse('Team membership is outside actor scope')
@ApiStandardNotFoundResponse('Team or Member was not found')
@ApiStandardConflictResponse('Team membership conflicts with current data')
export class TeamMembershipController {
  constructor(private readonly service: TeamMembershipService) {}

  @Get()
  @ResponseMessage('Team members returned successfully')
  @ApiOperation({ summary: 'List Team Members' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiStandardOkResponse(TeamMemberResponseDto, 'Team members returned')
  listMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: TeamMemberQueryDto,
    @Req() request: ObjectScopeRequest,
  ) {
    return this.service.listMembers(id, query, request.actorScope!);
  }

  @Post()
  @ResponseMessage('Team member added successfully')
  @ApiOperation({ summary: 'Add a Member to a Team' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiStandardCreatedResponse(TeamMemberResponseDto, 'Team member added')
  addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AddTeamMemberDto,
    @Req() request: ObjectScopeRequest,
  ) {
    return this.service.addMember(id, input, request.actorScope!);
  }

  @Delete(':memberId')
  @HttpCode(204)
  @ResponseMessage('Team member removed successfully')
  @ApiOperation({
    summary: 'Remove a Member from a Team’s active member list',
    description:
      'Ends the Member’s current Team membership. The Member is removed from the active Team list, while membership history is retained. This does not delete the Member or change User roles or permissions.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiParam({ name: 'memberId', type: String, format: 'uuid' })
  @ApiNoContentResponse({
    description: 'Active Team membership ended; historical membership is retained',
  })
  removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Req() request: ObjectScopeRequest,
  ) {
    return this.service.removeMember(id, memberId, request.actorScope!);
  }
}

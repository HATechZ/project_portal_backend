import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import {
  ApiStandardConflictResponse,
  ApiStandardForbiddenResponse,
  ApiStandardNotFoundResponse,
  ApiStandardOkResponse,
  ApiStandardUnauthorizedResponse,
} from '../common/decorators/api-standard-response.decorator';
import { AccessTokenGuard } from '../common/security/access-token.guard';
import { ActiveActor } from '../common/security/active-actor.decorator';
import { AuthenticationGuard } from '../common/security/authentication.guard';
import { ObjectScopeGuard } from '../common/security/object-scope.guard';
import { Permissions } from '../common/security/permissions.decorator';
import { PermissionsGuard } from '../common/security/permissions.guard';
import type { SessionActor } from '../common/security/session.types';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { WorkflowActionCode } from '../generated/prisma/client';
import {
  AssignDivisionDto,
  AssignMemberDto,
  AssignTeamDto,
  WorkRequestAssignmentResponseDto,
} from './dtos/work-request.dto';
import { WorkRequestService } from './work-request.service';

@ApiTags('work requests')
@ApiSecurity('bearer')
@Controller('work-requests/:id/assignments')
@UseGuards(
  AccessTokenGuard,
  TenantContextGuard,
  AuthenticationGuard,
  ObjectScopeGuard,
  PermissionsGuard,
)
@ApiStandardUnauthorizedResponse()
@ApiStandardForbiddenResponse()
@ApiStandardNotFoundResponse('Work Request or assignment target was not found')
@ApiStandardConflictResponse(
  'Assignment conflicts with current Work Request state',
)
export class WorkRequestAssignmentController {
  constructor(private readonly service: WorkRequestService) {}

  @Get()
  @Permissions(WorkflowActionCode.VIEW_WORK_REQUEST)
  @ApiOperation({ summary: 'Get Assignment History by Work Request ID' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Work Request ID' })
  @ApiStandardOkResponse(Object)
  @ResponseMessage('Work Request assignments returned successfully')
  history(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.assignmentHistory(id, actor);
  }

  @Post('division')
  @Permissions(WorkflowActionCode.WR_ASSIGN_DIVISION)
  @ApiOperation({ summary: 'Assign Division by Work Request ID' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Work Request ID' })
  @ApiStandardOkResponse(WorkRequestAssignmentResponseDto)
  @ResponseMessage('Work Request Division assigned successfully')
  division(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AssignDivisionDto,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.assignDivision(id, body, actor);
  }

  @Post('team')
  @Permissions(WorkflowActionCode.WR_ASSIGN_TEAM)
  @ApiOperation({ summary: 'Assign Team by Work Request ID' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Work Request ID' })
  @ApiStandardOkResponse(WorkRequestAssignmentResponseDto)
  @ResponseMessage('Work Request Team assigned successfully')
  team(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AssignTeamDto,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.assignTeam(id, body, actor);
  }

  @Post('member')
  @Permissions(WorkflowActionCode.WR_ASSIGN_MEMBER)
  @ApiOperation({ summary: 'Assign Member by Work Request ID' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Work Request ID' })
  @ApiStandardOkResponse(WorkRequestAssignmentResponseDto)
  @ResponseMessage('Work Request Member assigned successfully')
  member(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AssignMemberDto,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.assignMember(id, body, actor);
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../common/security/access-token.guard';
import { ActiveActor } from '../common/security/active-actor.decorator';
import { AuthenticationGuard } from '../common/security/authentication.guard';
import { FinalPermissions } from '../common/security/final-permissions.decorator';
import { FinalPermissionsGuard } from '../common/security/final-permissions.guard';
import type { SessionActor } from '../common/security/session.types';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { PermissionCode } from '../generated/prisma/client';
import {
  AppendWorkRequestMemberStepDto,
  DefineWorkRequestMemberSequenceDto,
  DefineWorkRequestTeamSequenceDto,
  SubmitWorkRequestMemberStepDto,
} from './dtos/work-request.dto';
import { WorkRequestExecutionProvider } from './providers/work-request-execution.provider';
import { InternalCycleResponseDto } from './dtos/internal-cycle-response.dto';
import { wrapEnvelope } from '../common/swagger/wrap-envelope';

@ApiTags('work requests')
@ApiSecurity('bearer')
@Controller('work-requests/:id')
@UseGuards(
  AccessTokenGuard,
  TenantContextGuard,
  AuthenticationGuard,
  FinalPermissionsGuard,
)
export class WorkRequestExecutionController {
  constructor(private readonly execution: WorkRequestExecutionProvider) {}

  @Get('internal-cycles/:cycleId')
  @FinalPermissions(PermissionCode.VIEW_WORK_REQUEST)
  @ApiOperation({ summary: 'Get Work Request Internal Cycle' })
  @ApiOkResponse({ type: wrapEnvelope(InternalCycleResponseDto) })
  internalCycle(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.execution.internalCycle(id, cycleId, actor);
  }
  @Post('division-cycles/:cycleId/team-sequence')
  @FinalPermissions(PermissionCode.ASSIGN_WORK_REQUEST_TEAM)
  @ApiOperation({ summary: 'Define Division Team Sequence' })
  defineTeamSequence(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @Body() body: DefineWorkRequestTeamSequenceDto,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.execution.defineTeamSequence(id, cycleId, body, actor);
  }
  @Post('team-steps/:teamStepId/member-sequence')
  @FinalPermissions(PermissionCode.ASSIGN_WORK_REQUEST_MEMBER)
  @ApiOperation({ summary: 'Define Team Member Sequence' })
  defineMemberSequence(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('teamStepId', ParseUUIDPipe) teamStepId: string,
    @Body() body: DefineWorkRequestMemberSequenceDto,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.execution.defineMemberSequence(id, teamStepId, body, actor);
  }
  @Post('team-steps/:teamStepId/member-steps')
  @FinalPermissions(PermissionCode.ASSIGN_WORK_REQUEST_MEMBER)
  @ApiOperation({ summary: 'Assign Member to Team Step' })
  appendMemberStep(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('teamStepId', ParseUUIDPipe) teamStepId: string,
    @Body() body: AppendWorkRequestMemberStepDto,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.execution.appendMemberStep(id, teamStepId, body, actor);
  }
  @Post('member-steps/:memberStepId/submit')
  @FinalPermissions(PermissionCode.SUBMIT_WORK_REQUEST)
  @ApiOperation({ summary: 'Submit Member Step' })
  submitMemberStep(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberStepId', ParseUUIDPipe) memberStepId: string,
    @Body() body: SubmitWorkRequestMemberStepDto,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.execution.submitMemberStep(id, memberStepId, body, actor);
  }
  @Post('team-steps/:teamStepId/complete')
  @FinalPermissions(PermissionCode.APPROVE_WORK_REQUEST_REVIEW)
  @ApiOperation({ summary: 'Complete Team Step' })
  completeTeamStep(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('teamStepId', ParseUUIDPipe) teamStepId: string,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.execution.completeTeamStep(id, teamStepId, actor);
  }
}

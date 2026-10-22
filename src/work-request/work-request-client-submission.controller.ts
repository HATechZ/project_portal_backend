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
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../common/security/access-token.guard';
import { ActiveActor } from '../common/security/active-actor.decorator';
import { AuthenticationGuard } from '../common/security/authentication.guard';
import { FinalPermissionsGuard } from '../common/security/final-permissions.guard';
import { FinalPermissions } from '../common/security/final-permissions.decorator';
import { PermissionCode } from '../generated/prisma/client';
import type { SessionActor } from '../common/security/session.types';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { WorkRequestService } from './work-request.service';
import {
  CreateWorkRequestClientSubmissionDto,
  RouteWorkRequestClientRevisionDto,
  WorkRequestClientDecisionDto,
  WorkRequestClientDecisionResponseDto,
  WorkRequestClientRevisionRouteResponseDto,
  WorkRequestClientSubmissionResponseDto,
  RequestWorkRequestReconsiderationDto,
  DecideWorkRequestReconsiderationDto,
} from './dtos/work-request.dto';

@ApiTags('work requests')
@ApiSecurity('bearer')
@Controller('work-requests/:id')
@UseGuards(
  AccessTokenGuard,
  TenantContextGuard,
  AuthenticationGuard,
  FinalPermissionsGuard,
)
export class WorkRequestClientSubmissionController {
  constructor(private readonly service: WorkRequestService) {}
  @Post('client-submissions')
  @FinalPermissions(PermissionCode.SUBMIT_FOR_EXTERNAL_REVIEW)
  @ApiOperation({ summary: 'Submit immutable final package for client review' })
  @ApiCreatedResponse({ type: WorkRequestClientSubmissionResponseDto })
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateWorkRequestClientSubmissionDto,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.submitClientPackage(id, body, actor);
  }
  @Get('client-submissions')
  @ApiOperation({ summary: 'List permitted client submission packages' })
  @ApiOkResponse({
    type: WorkRequestClientSubmissionResponseDto,
    isArray: true,
  })
  list(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.clientSubmissions(id, actor);
  }
  @Post('client-submissions/:submissionId/decision')
  @ApiOperation({ summary: 'Decide submitted client package' })
  @ApiCreatedResponse({ type: WorkRequestClientDecisionResponseDto })
  decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() body: WorkRequestClientDecisionDto,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.clientDecision(id, submissionId, body, actor);
  }
  @Post('reconsideration')
  @FinalPermissions(PermissionCode.REQUEST_WORK_REQUEST_REVISION)
  requestReconsideration(@Param('id', ParseUUIDPipe) id: string, @Body() body: RequestWorkRequestReconsiderationDto, @ActiveActor() actor: SessionActor) {
    return this.service.requestReconsideration(id, body, actor);
  }
  @Post('reconsideration/decision')
  decideReconsideration(@Param('id', ParseUUIDPipe) id: string, @Body() body: DecideWorkRequestReconsiderationDto, @ActiveActor() actor: SessionActor) {
    return this.service.decideReconsideration(id, body, actor);
  }
  @Post('client-revision-route')
  @ApiOperation({ summary: 'Route client revision to generic responsibility' })
  @ApiCreatedResponse({ type: WorkRequestClientRevisionRouteResponseDto })
  route(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RouteWorkRequestClientRevisionDto,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.routeClientRevision(id, body, actor);
  }
}

import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../common/security/access-token.guard';
import { ActiveActor } from '../common/security/active-actor.decorator';
import { AuthenticationGuard } from '../common/security/authentication.guard';
import { FinalPermissions } from '../common/security/final-permissions.decorator';
import { FinalPermissionsGuard } from '../common/security/final-permissions.guard';
import type { SessionActor } from '../common/security/session.types';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { PermissionCode } from '../generated/prisma/client';
import { RequestWorkRequestRouteRevisionDto, ResubmitWorkRequestRouteRevisionDto } from './dtos/work-request.dto';
import { WorkRequestRevisionProvider } from './providers/work-request-revision.provider';

@ApiTags('work requests')
@ApiSecurity('bearer')
@Controller('work-requests/:id')
@UseGuards(AccessTokenGuard, TenantContextGuard, AuthenticationGuard, FinalPermissionsGuard)
export class WorkRequestRevisionController {
  constructor(private readonly revisions: WorkRequestRevisionProvider) {}

  @Post('revisions')
  @FinalPermissions(PermissionCode.REQUEST_WORK_REQUEST_REVISION)
  request(@Param('id', ParseUUIDPipe) id: string, @Body() body: RequestWorkRequestRouteRevisionDto, @ActiveActor() actor: SessionActor) {
    return this.revisions.request(id, body, actor);
  }
  @Post('revisions/:revisionId/resubmit')
  @FinalPermissions(PermissionCode.SUBMIT_WORK_REQUEST)
  resubmit(@Param('id', ParseUUIDPipe) id: string, @Param('revisionId', ParseUUIDPipe) revisionId: string, @Body() body: ResubmitWorkRequestRouteRevisionDto, @ActiveActor() actor: SessionActor) {
    return this.revisions.resubmit(id, revisionId, body, actor);
  }
}

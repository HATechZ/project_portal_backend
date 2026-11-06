import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../common/security/access-token.guard';
import { ActiveActor } from '../common/security/active-actor.decorator';
import { AuthenticationGuard } from '../common/security/authentication.guard';
import { FinalPermissions } from '../common/security/final-permissions.decorator';
import { FinalPermissionsGuard } from '../common/security/final-permissions.guard';
import type { SessionActor } from '../common/security/session.types';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { PermissionCode } from '../generated/prisma/client';
import { ReplyWorkRequestRouteMessageDto, SendWorkRequestRouteMessageDto } from './dtos/work-request.dto';
import { WorkRequestCommunicationProvider } from './providers/work-request-communication.provider';

@ApiTags('work requests')
@ApiSecurity('bearer')
@Controller('work-requests/:id')
@UseGuards(AccessTokenGuard, TenantContextGuard, AuthenticationGuard, FinalPermissionsGuard)
export class WorkRequestCommunicationController {
  constructor(private readonly communications: WorkRequestCommunicationProvider) {}
  @Get('communication-recipients') @FinalPermissions(PermissionCode.VIEW_WORK_REQUEST)
  @ApiOperation({ summary: 'Get Work Request Communication Recipients' })
  recipients(@Param('id', ParseUUIDPipe) id: string, @ActiveActor() actor: SessionActor) { return this.communications.recipients(id, actor); }
  @Post('conversations/messages') @FinalPermissions(PermissionCode.REQUEST_INFO)
  @ApiOperation({ summary: 'Send Work Request Conversation Message' })
  send(@Param('id', ParseUUIDPipe) id: string, @Body() body: SendWorkRequestRouteMessageDto, @ActiveActor() actor: SessionActor) { return this.communications.send(id, body.recipientActorIds, body.message, body.documentVersionIds, actor); }
  @Get('conversations/:conversationId') @FinalPermissions(PermissionCode.VIEW_WORK_REQUEST)
  @ApiOperation({ summary: 'Get Work Request Conversation' })
  read(@Param('id', ParseUUIDPipe) id: string, @Param('conversationId', ParseUUIDPipe) conversationId: string, @ActiveActor() actor: SessionActor) { return this.communications.read(id, conversationId, actor); }
  @Post('conversations/:conversationId/messages') @FinalPermissions(PermissionCode.REQUEST_INFO)
  @ApiOperation({ summary: 'Reply to Work Request Conversation' })
  reply(@Param('id', ParseUUIDPipe) id: string, @Param('conversationId', ParseUUIDPipe) conversationId: string, @Body() body: ReplyWorkRequestRouteMessageDto, @ActiveActor() actor: SessionActor) { return this.communications.reply(id, conversationId, body.message, body.documentVersionIds, actor); }
  @Get('main-history') @FinalPermissions(PermissionCode.VIEW_WORK_REQUEST)
  @ApiOperation({ summary: 'Get Work Request Main History' })
  mainHistory(@Param('id', ParseUUIDPipe) id: string, @ActiveActor() actor: SessionActor) { return this.communications.mainHistory(id, actor); }
  @Get('internal-history') @FinalPermissions(PermissionCode.VIEW_WORK_REQUEST)
  @ApiOperation({ summary: 'Get Work Request Internal History' })
  internalHistory(@Param('id', ParseUUIDPipe) id: string, @ActiveActor() actor: SessionActor) { return this.communications.internalHistory(id, actor); }
}

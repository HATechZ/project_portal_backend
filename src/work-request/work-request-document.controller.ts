import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiSecurity, ApiTags } from '@nestjs/swagger';
import {
  ApiStandardForbiddenResponse,
  ApiStandardNotFoundResponse,
  ApiStandardOkResponse,
  ApiStandardUnauthorizedResponse,
} from '../common/decorators/api-standard-response.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { AccessTokenGuard } from '../common/security/access-token.guard';
import { ActiveActor } from '../common/security/active-actor.decorator';
import { AuthenticationGuard } from '../common/security/authentication.guard';
import { ObjectScopeGuard } from '../common/security/object-scope.guard';
import { Permissions } from '../common/security/permissions.decorator';
import { PermissionsGuard } from '../common/security/permissions.guard';
import type { SessionActor } from '../common/security/session.types';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { WorkflowActionCode } from '../generated/prisma/client';
import { WorkRequestService } from './work-request.service';

@ApiTags('work requests')
@ApiSecurity('bearer')
@Controller('work-requests/:id/documents')
@UseGuards(
  AccessTokenGuard,
  TenantContextGuard,
  AuthenticationGuard,
  ObjectScopeGuard,
  PermissionsGuard,
)
@ApiStandardUnauthorizedResponse()
@ApiStandardForbiddenResponse()
@ApiStandardNotFoundResponse('Work Request document was not found')
export class WorkRequestDocumentController {
  constructor(private readonly service: WorkRequestService) {}
  @Get()
  @Permissions(WorkflowActionCode.VIEW_WORK_REQUEST)
  @ApiOperation({ summary: 'Get Documents by Work Request ID' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Work Request ID' })
  @ApiStandardOkResponse(Object, 'Work Request documents returned')
  @ResponseMessage('Work Request documents returned successfully')
  list(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.documents(id, actor);
  }
  @Get(':documentId/versions')
  @Permissions(WorkflowActionCode.VIEW_WORK_REQUEST)
  @ApiOperation({
    summary: 'Get Document Versions by Work Request ID and Document ID',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Work Request ID' })
  @ApiParam({
    name: 'documentId',
    format: 'uuid',
    description: 'Work Request Document ID',
  })
  @ApiStandardOkResponse(Object, 'Work Request document versions returned')
  @ResponseMessage('Work Request document versions returned successfully')
  versions(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.documentVersions(id, documentId, actor);
  }
}

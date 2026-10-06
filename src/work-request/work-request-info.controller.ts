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
import {
  ApiStandardArrayResponse,
  ApiStandardConflictResponse,
  ApiStandardForbiddenResponse,
  ApiStandardNotFoundResponse,
  ApiStandardOkResponse,
  ApiStandardUnauthorizedResponse,
} from '../common/decorators/api-standard-response.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { AccessTokenGuard } from '../common/security/access-token.guard';
import { ActiveActor } from '../common/security/active-actor.decorator';
import { AuthenticationGuard } from '../common/security/authentication.guard';
import { FinalPermissions } from '../common/security/final-permissions.decorator';
import { FinalPermissionsGuard } from '../common/security/final-permissions.guard';
import type { SessionActor } from '../common/security/session.types';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { PermissionCode } from '../generated/prisma/client';
import {
  CreateWorkRequestInfoRequestDto,
  RespondWorkRequestInfoRequestDto,
  WorkRequestInfoRequestDto,
  WorkRequestInfoResponseDto,
} from './dtos/work-request.dto';
import { WorkRequestService } from './work-request.service';

@ApiTags('work requests')
@ApiSecurity('bearer')
@Controller('work-requests/:id/info-requests')
@UseGuards(
  AccessTokenGuard,
  TenantContextGuard,
  AuthenticationGuard,
  FinalPermissionsGuard,
)
@ApiStandardUnauthorizedResponse()
@ApiStandardForbiddenResponse()
@ApiStandardNotFoundResponse(
  'Work Request or Information Request was not found',
)
@ApiStandardConflictResponse(
  'Information Request conflicts with its current lifecycle state',
)
export class WorkRequestInfoController {
  constructor(private readonly service: WorkRequestService) {}

  @Post()
  @FinalPermissions(PermissionCode.REQUEST_INFO)
  @ApiOperation({ summary: 'Request Information by Work Request ID' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Work Request ID' })
  @ApiStandardOkResponse(WorkRequestInfoRequestDto)
  @ResponseMessage('Information requested successfully')
  request(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateWorkRequestInfoRequestDto,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.requestInfo(id, body, actor);
  }

  @Post(':infoRequestId/respond')
  @FinalPermissions(PermissionCode.RESPOND_TO_INFO_REQUEST)
  @ApiOperation({
    summary:
      'Respond to Information Request by Work Request ID and Information Request ID',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Work Request ID' })
  @ApiParam({
    name: 'infoRequestId',
    format: 'uuid',
    description: 'Information Request ID',
  })
  @ApiStandardOkResponse(WorkRequestInfoResponseDto)
  @ResponseMessage('Information response submitted successfully')
  respond(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('infoRequestId', ParseUUIDPipe) infoRequestId: string,
    @Body() body: RespondWorkRequestInfoRequestDto,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.respondInfo(id, infoRequestId, body, actor);
  }

  @Get()
  @FinalPermissions(PermissionCode.VIEW_WORK_REQUEST)
  @ApiOperation({ summary: 'Get Information Requests by Work Request ID' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Work Request ID' })
  @ApiStandardArrayResponse(WorkRequestInfoRequestDto)
  @ResponseMessage('Information requests returned successfully')
  history(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveActor() actor: SessionActor,
  ): Promise<WorkRequestInfoRequestDto[]> {
    return this.service.infoHistory(id, actor);
  }
}

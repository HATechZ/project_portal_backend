import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiSecurity, ApiTags } from '@nestjs/swagger';
import {
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
import { ObjectScopeGuard } from '../common/security/object-scope.guard';
import { PermissionsGuard } from '../common/security/permissions.guard';
import type { SessionActor } from '../common/security/session.types';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import {
  WorkRequestActionDto,
  WorkRequestWorkflowNoteDto,
  WorkRequestWorkflowResponseDto,
} from './dtos/work-request.dto';
import { WorkRequestService } from './work-request.service';

@ApiTags('work requests')
@ApiSecurity('bearer')
@Controller('work-requests/:id')
@UseGuards(
  AccessTokenGuard,
  TenantContextGuard,
  AuthenticationGuard,
  ObjectScopeGuard,
  PermissionsGuard,
)
@ApiStandardUnauthorizedResponse()
@ApiStandardForbiddenResponse()
@ApiStandardNotFoundResponse('Work Request or Workflow Action was not found')
@ApiStandardConflictResponse(
  'Workflow action conflicts with current Work Request state',
)
export class WorkRequestWorkflowController {
  constructor(private readonly service: WorkRequestService) {}

  @Post('submit')
  @ApiOperation({ summary: 'Submit Work Request by Work Request ID' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Work Request ID' })
  @ApiStandardOkResponse(WorkRequestWorkflowResponseDto)
  @ResponseMessage('Work Request submitted successfully')
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: WorkRequestWorkflowNoteDto,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.submit(id, body, actor);
  }

  @Post('actions')
  @ApiOperation({
    summary: 'Apply Work Request workflow action by Work Request ID',
    description:
      'Approve Work Request by Team Lead by Work Request ID; Request Revision by Team Lead by Work Request ID; Approve Work Request by Division Lead by Work Request ID; Request Revision by Division Lead by Work Request ID; Approve Work Request by Division Head by Work Request ID; Request Revision by Division Head by Work Request ID.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Work Request ID' })
  @ApiStandardOkResponse(WorkRequestWorkflowResponseDto)
  @ResponseMessage('Work Request workflow action applied successfully')
  action(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: WorkRequestActionDto,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.action(id, body, actor);
  }
}

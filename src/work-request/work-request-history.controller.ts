import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { PaginationQueryDto } from '../common/pagination/dtos/pagination-query.dto';
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
@Controller('work-requests/:id')
@UseGuards(
  AccessTokenGuard,
  TenantContextGuard,
  AuthenticationGuard,
  ObjectScopeGuard,
  PermissionsGuard,
)
export class WorkRequestHistoryController {
  constructor(private readonly service: WorkRequestService) {}
  @Get('events')
  @Permissions(WorkflowActionCode.VIEW_WORK_REQUEST)
  @ApiOperation({ summary: 'Get Work Request History by Work Request ID' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Work Request ID' })
  @ResponseMessage('Work Request events returned successfully')
  events(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.events(id, query, actor);
  }
  @Get('available-actions')
  @Permissions(WorkflowActionCode.VIEW_WORK_REQUEST)
  @ApiOperation({ summary: 'Get Available Actions by Work Request ID' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Work Request ID' })
  @ResponseMessage('Work Request actions returned successfully')
  actions(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.availableActions(id, actor);
  }
}

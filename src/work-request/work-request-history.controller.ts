import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiSecurity, ApiTags } from '@nestjs/swagger';
import {
  ApiStandardArrayResponse,
  ApiStandardForbiddenResponse,
  ApiStandardNotFoundResponse,
  ApiStandardUnauthorizedResponse,
} from '../common/decorators/api-standard-response.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { PaginationQueryDto } from '../common/pagination/dtos/pagination-query.dto';
import { ApiPaginatedResponse } from '../common/swagger/api-paginated-response.decorator';
import { AccessTokenGuard } from '../common/security/access-token.guard';
import { ActiveActor } from '../common/security/active-actor.decorator';
import { AuthenticationGuard } from '../common/security/authentication.guard';
import { FinalPermissions } from '../common/security/final-permissions.decorator';
import { FinalPermissionsGuard } from '../common/security/final-permissions.guard';
import type { SessionActor } from '../common/security/session.types';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { PermissionCode } from '../generated/prisma/client';
import {
  WorkRequestAvailableActionResponseDto,
  WorkRequestEventResponseDto,
} from './dtos/work-request.dto';
import { WorkRequestService } from './work-request.service';

@ApiTags('work requests')
@ApiSecurity('bearer')
@Controller('work-requests/:id')
@UseGuards(
  AccessTokenGuard,
  TenantContextGuard,
  AuthenticationGuard,
  FinalPermissionsGuard,
)
@ApiStandardUnauthorizedResponse()
@ApiStandardForbiddenResponse()
@ApiStandardNotFoundResponse('Work Request was not found')
export class WorkRequestHistoryController {
  constructor(private readonly service: WorkRequestService) {}
  @Get('events')
  @FinalPermissions(PermissionCode.VIEW_WORK_REQUEST)
  @ApiOperation({ summary: 'Get Work Request History by Work Request ID' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Work Request ID' })
  @ApiPaginatedResponse(WorkRequestEventResponseDto)
  @ResponseMessage('Work Request events returned successfully')
  events(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.events(id, query, actor);
  }
  @Get('available-actions')
  @FinalPermissions(PermissionCode.VIEW_WORK_REQUEST)
  @ApiOperation({ summary: 'Get Available Actions by Work Request ID' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Work Request ID' })
  @ApiStandardArrayResponse(WorkRequestAvailableActionResponseDto)
  @ResponseMessage('Work Request actions returned successfully')
  actions(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.availableActions(id, actor);
  }
}

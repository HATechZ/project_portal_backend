import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiSecurity, ApiTags } from '@nestjs/swagger';
import {
  ApiStandardBadRequestResponse,
  ApiStandardConflictResponse,
  ApiStandardForbiddenResponse,
  ApiStandardNotFoundResponse,
  ApiStandardOkResponse,
  ApiStandardUnauthorizedResponse,
} from '../common/decorators/api-standard-response.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { AccessTokenGuard } from '../common/security/access-token.guard';
import { ActiveUser } from '../common/security/active-user.decorator';
import { AllowActorRoles } from '../common/security/allow-actor-roles.decorator';
import { AuthenticationGuard } from '../common/security/authentication.guard';
import { ObjectScopeGuard } from '../common/security/object-scope.guard';
import { Permissions } from '../common/security/permissions.decorator';
import { PermissionsGuard } from '../common/security/permissions.guard';
import type { SessionUser } from '../common/security/session.types';
import { SystemAdminGuard } from '../common/security/system-admin.guard';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { ActorRoleCode, WorkflowActionCode } from '../generated/prisma/client';
import { DivisionService } from './division.service';
import {
  AssignDivisionLeadDto,
  DivisionLeadDetailDto,
  DivisionLeadResponseDto,
} from './dtos';

/**
 * Division Lead assignment (04.1.1). Separate from Division CRUD because the
 * authority differs: these routes require ASSIGN_LEADER and admit
 * division_head, while CRUD stays ADD_DIVISION and system_admin-only.
 */
@ApiTags('division')
@ApiSecurity('bearer')
@Controller('division')
@UseGuards(
  AccessTokenGuard,
  TenantContextGuard,
  AuthenticationGuard,
  ObjectScopeGuard,
  SystemAdminGuard,
  PermissionsGuard,
)
@Permissions(WorkflowActionCode.ASSIGN_LEADER)
@AllowActorRoles(ActorRoleCode.division_head)
@ApiStandardBadRequestResponse()
@ApiStandardUnauthorizedResponse()
@ApiStandardForbiddenResponse('Division Lead assignment access required')
@ApiStandardNotFoundResponse('Division was not found')
@ApiStandardConflictResponse(
  'Division Lead request conflicts with current data',
)
export class DivisionLeadController {
  constructor(private readonly divisionService: DivisionService) {}

  @Put(':id/lead')
  @ResponseMessage('Division Lead assigned successfully')
  @ApiOperation({
    summary: 'Assign Division Lead',
    description:
      'Assign an eligible same-Company Member as Division Lead. The Member need ' +
      'not belong to this Division. Revokes the incumbent Lead, and is a no-op ' +
      'when the Member already leads it. System Admin or Division Head.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiStandardOkResponse(DivisionLeadResponseDto, 'Division Lead assigned')
  assignLead(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AssignDivisionLeadDto,
    @ActiveUser() activeUser: SessionUser,
  ) {
    return this.divisionService.assignLead(id, input, activeUser.id);
  }

  @Get(':id/lead')
  @ResponseMessage('Division Lead returned successfully')
  @ApiOperation({
    summary: 'Get the current Division Lead',
    description:
      'Returns the active Lead, or null when the Division has none. A ' +
      'Lead-less Division is valid and is not a 404.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiStandardOkResponse(DivisionLeadDetailDto, 'Division Lead returned')
  findLead(@Param('id', ParseUUIDPipe) id: string) {
    return this.divisionService.findLead(id);
  }

  @Delete(':id/lead')
  @ResponseMessage('Division Lead revoked successfully')
  @ApiOperation({
    summary: 'Revoke the current Division Lead',
    description:
      'Marks the active Lead revoked by timestamp; the row is retained. ' +
      '404 when the Division has no active Lead.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiStandardOkResponse(DivisionLeadDetailDto, 'Division Lead revoked')
  revokeLead(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveUser() activeUser: SessionUser,
  ) {
    return this.divisionService.revokeLead(id, activeUser.id);
  }
}

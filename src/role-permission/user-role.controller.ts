import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOperation,
  ApiQuery,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ActiveUser } from '../common/security/active-user.decorator';
import { AccessTokenGuard } from '../common/security/access-token.guard';
import { AuthenticationGuard } from '../common/security/authentication.guard';
import { SystemAdminGuard } from '../common/security/system-admin.guard';
import type { SessionUser } from '../common/security/session.types';
import {
  ApiStandardBadRequestResponse,
  ApiStandardArrayResponse,
  ApiStandardConflictResponse,
  ApiStandardCreatedResponse,
  ApiStandardForbiddenResponse,
  ApiStandardNotFoundResponse,
  ApiStandardUnauthorizedResponse,
} from '../common/decorators/api-standard-response.decorator';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import {
  AssignUserRoleDto,
  RoleOptionResponseDto,
  UserRoleAssignmentResponseDto,
} from './dtos';
import { RolePermissionService } from './role-permission.service';

@ApiTags('role & permission')
@ApiSecurity('bearer')
@Controller()
@UseGuards(
  AccessTokenGuard,
  TenantContextGuard,
  AuthenticationGuard,
  SystemAdminGuard,
)
@ApiStandardBadRequestResponse()
@ApiStandardUnauthorizedResponse()
@ApiStandardForbiddenResponse('System administrator access required')
export class UserRoleController {
  constructor(private readonly service: RolePermissionService) {}

  @Get('user/:userId/role-options')
  @ResponseMessage('Available roles returned successfully')
  @ApiOperation({ summary: 'List roles available for assignment' })
  @ApiStandardArrayResponse(RoleOptionResponseDto)
  findRoleOptions(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.service.findRoleOptions(userId);
  }

  @Get('user/:userId/role')
  @ResponseMessage('User roles returned successfully')
  @ApiOperation({ summary: 'List roles assigned to a user' })
  @ApiQuery({ name: 'includeRevoked', required: false, type: Boolean })
  @ApiStandardArrayResponse(UserRoleAssignmentResponseDto)
  @ApiStandardNotFoundResponse('User was not found')
  findUserRoles(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('includeRevoked', new ParseBoolPipe({ optional: true }))
    includeRevoked = false,
  ) {
    return this.service.findUserRoles(userId, includeRevoked);
  }

  @Post('user/:userId/role')
  @ResponseMessage('Role assigned successfully')
  @ApiOperation({ summary: 'Assign a role to a user' })
  @ApiStandardCreatedResponse(UserRoleAssignmentResponseDto, 'Role assigned')
  @ApiStandardNotFoundResponse('User or role was not found')
  @ApiStandardConflictResponse('The user already has this role')
  assignUserRole(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() input: AssignUserRoleDto,
    @ActiveUser() activeUser: SessionUser,
  ) {
    return this.service.assignUserRole(userId, input, activeUser.id);
  }

  @Delete('user/:userId/role/:roleId')
  @ResponseMessage('Role revoked successfully')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a role from a user' })
  @ApiNoContentResponse({ description: 'Role revoked' })
  @ApiStandardNotFoundResponse('User, role, or active assignment was not found')
  @ApiStandardConflictResponse(
    'Cannot revoke your own or the final active administrator role',
  )
  revokeUserRole(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @ActiveUser() activeUser: SessionUser,
  ) {
    return this.service.revokeUserRole(userId, roleId, activeUser.id);
  }
}
